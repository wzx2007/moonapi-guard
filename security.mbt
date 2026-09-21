///|
/// Validate requirement structure before analyzing OR alternatives and AND scopes.
fn validate_security(ctx : Context, value : Json, path : String) -> Unit {
  match value {
    Array(requirements) => {
      if requirements.length() > 64 {
        ctx.errors.push(
          path + ": at most 64 security alternatives are supported",
        )
        return
      }
      for item in requirements {
        if !is_object(item) {
          ctx.errors.push(path + ": security requirement must be an object")
          continue
        }
        if keys(item).length() > 16 {
          ctx.errors.push(
            path + ": at most 16 schemes per alternative are supported",
          )
          continue
        }
        for name in keys(item) {
          match field(item, name) {
            Array(scopes) => {
              if scopes.length() > 64 {
                ctx.errors.push(
                  path + ": at most 64 scopes per scheme are supported",
                )
                continue
              }
              for scope in scopes {
                match scope {
                  String(_) => ()
                  _ =>
                    ctx.errors.push(path + ": security scopes must be strings")
                }
              }
            }
            _ =>
              ctx.errors.push(path + ": security scheme scopes must be arrays")
          }
        }
      }
    }
    _ => ctx.errors.push(path + ": security must be an array")
  }
}

///|
/// An explicit operation security array overrides the root, including [].
fn effective_security(doc : Json, operation : Json) -> Array[Json] {
  let value = if has(operation, "security") {
    field(operation, "security")
  } else {
    field(doc, "security")
  }
  let alternatives = arr(value)
  if alternatives.is_empty() {
    [Json::object(Map([]))]
  } else {
    alternatives
  }
}

///|
fn security_definition(
  ctx : Context,
  doc : Json,
  name : String,
  op : String,
  path : String,
) -> Json? {
  let definitions = field(field(doc, "components"), "securitySchemes")
  if !has(definitions, name) {
    ctx.errors.push(path + ": undefined security scheme " + name)
    return None
  }
  resolve(ctx, doc, field(definitions, name), op, path)
}

///| Only effective requirements participate; root auth overridden by [] does not

///|
/// falsely mark an anonymous operation as incomplete.
fn validate_effective_security(
  ctx : Context,
  doc : Json,
  operation : Json,
  op : String,
  path : String,
) -> Unit {
  for alternative in effective_security(doc, operation) {
    for name in keys(alternative) {
      guard security_definition(ctx, doc, name, op, path) is Some(definition) else {
        continue
      }
      let kind = str(field(definition, "type"))
      if !["http", "apiKey", "oauth2", "openIdConnect"].contains(kind) {
        ctx.errors.push(
          path + ": unsupported or missing security scheme type: " + name,
        )
        continue
      }
      if kind == "apiKey" &&
        (
          str(field(definition, "name")) == "" ||
          !["header", "query", "cookie"].contains(str(field(definition, "in")))
        ) {
        ctx.errors.push(path + ": apiKey scheme needs a name and valid in")
      }
      if kind == "http" {
        let scheme = str(field(definition, "scheme")).to_lower()
        if scheme == "" {
          ctx.errors.push(path + ": HTTP security scheme needs scheme")
        } else if !["basic", "bearer"].contains(scheme) {
          ctx.add(
            "warning",
            "SECURITY_SCHEME_REVIEW",
            op,
            path,
            "HTTP authentication scheme requires review: " + scheme,
          )
        }
      }
      if kind == "oauth2" &&
        (
          !is_object(field(definition, "flows")) ||
          keys(field(definition, "flows")).is_empty()
        ) {
        ctx.errors.push(path + ": oauth2 scheme needs nonempty flows")
      }
      if kind == "openIdConnect" &&
        str(field(definition, "openIdConnectUrl")) == "" {
        ctx.errors.push(path + ": OpenID Connect scheme needs openIdConnectUrl")
      }
      if kind != "oauth2" &&
        kind != "openIdConnect" &&
        !arr(field(alternative, name)).is_empty() {
        ctx.errors.push(
          path + ": non-OAuth security scheme cannot require scopes",
        )
      }
    }
  }
}

///| New AND requirements must be a subset of an old alternative's guaranteed

///|
/// credentials and scopes. Every old OR alternative needs a new accepting one.
fn accepts_security(old_branch : Json, new_branch : Json) -> Bool {
  keys(new_branch).all(name => {
    has(old_branch, name) &&
    arr(field(new_branch, name)).all(scope => {
      contains_value(field(old_branch, name), scope)
    })
  })
}

///|
fn compare_security(
  ctx : Context,
  old_doc : Json,
  new_doc : Json,
  old_op : Json,
  new_op : Json,
  op : String,
  path : String,
) -> Unit {
  let older = effective_security(old_doc, old_op)
  let newer = effective_security(new_doc, new_op)
  let p = pointer(path, "security")
  for branch in older {
    if !newer.any(candidate => accepts_security(branch, candidate)) {
      ctx.add(
        "breaking", "SECURITY_TIGHTENED", op, p, "A previously accepted authentication alternative no longer satisfies the required schemes/scopes",
      )
      break
    }
  }
  let checked : Map[String, Bool] = Map([])
  for branch in older {
    for name in keys(branch) {
      if checked.contains(name) || !newer.any(b => has(b, name)) {
        continue
      }
      checked[name] = true
      guard security_definition(ctx, old_doc, name, op, p) is Some(a) else {
        continue
      }
      guard security_definition(ctx, new_doc, name, op, p) is Some(b) else {
        continue
      }
      // Descriptions and bearerFormat are annotations, not credential identity.
      if ["type", "in", "name", "scheme", "flows", "openIdConnectUrl"].any(k => {
          !same(field(a, k), field(b, k))
        }) {
        ctx.add(
          "warning",
          "SECURITY_SCHEME_CHANGED",
          op,
          p,
          "Credential definition changed for scheme '" +
          name +
          "'; token/wire compatibility requires review",
        )
      }
    }
  }
}
