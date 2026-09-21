///|
/// Deliberately a subset validator, not a replacement for a full OAS linter.
fn validate_schema(
  ctx : Context,
  doc : Json,
  value : Json,
  op : String,
  path : String,
  depth : Int,
) -> Unit {
  if !ctx.budget() {
    return
  }
  if depth > 48 {
    ctx.add(
      "warning", "SCHEMA_DEPTH", op, path, "Recursive or deeply nested schema exceeds the validation depth limit",
    )
    return
  }
  guard resolve(ctx, doc, value, op, path) is Some(schema) else { return }
  if !is_object(schema) {
    ctx.errors.push(path + ": Schema Object must be an object")
    return
  }
  let supported = [
    "type", "title", "description", "default", "example", "examples", "deprecated",
    "externalDocs", "xml", "nullable", "enum", "properties", "required", "additionalProperties",
    "items", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength",
    "maxLength", "minItems", "maxItems", "minProperties", "maxProperties", "pattern",
    "format", "multipleOf", "uniqueItems",
  ]
  for key in keys(schema) {
    if !supported.contains(key) && !key.has_prefix("x-") {
      ctx.add(
        "warning",
        "UNSUPPORTED_SCHEMA",
        op,
        pointer(path, key),
        "Schema keyword is outside the supported subset: " + key,
      )
    }
  }
  let t = str(field(schema, "type"))
  if has(schema, "type") &&
    !["object", "array", "string", "number", "integer", "boolean"].contains(t) {
    ctx.errors.push(
      path + ": type must be a supported OpenAPI 3.0 scalar type name",
    )
  }
  if t == "" && !unconstrained(schema) {
    ctx.add(
      "warning", "IMPLICIT_TYPE", op, path, "Constrained schemas without an explicit type require review",
    )
  }
  for
    key in [
      "nullable", "exclusiveMinimum", "exclusiveMaximum", "uniqueItems", "readOnly",
      "writeOnly",
    ] {
    if has(schema, key) &&
      field(schema, key) != Json::boolean(true) &&
      field(schema, key) != Json::boolean(false) {
      ctx.errors.push(pointer(path, key) + ": expected boolean")
    }
  }
  for
    key in [
      "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "minProperties",
      "maxProperties", "multipleOf",
    ] {
    if has(schema, key) {
      match number(field(schema, key)) {
        None => ctx.errors.push(pointer(path, key) + ": expected number")
        Some(n) => {
          if key != "minimum" &&
            key != "maximum" &&
            (n < 0.0 || (key != "multipleOf" && n != n.floor())) {
            ctx.errors.push(
              pointer(path, key) + ": expected nonnegative integer",
            )
          }
          if key == "multipleOf" && n <= 0.0 {
            ctx.errors.push(pointer(path, key) + ": must be positive")
          }
        }
      }
    }
  }
  for key in ["pattern", "format"] {
    if has(schema, key) {
      match field(schema, key) {
        String(_) => ()
        _ => ctx.errors.push(pointer(path, key) + ": expected string")
      }
    }
  }
  for
    pair in [
      ("minimum", "maximum"),
      ("minLength", "maxLength"),
      ("minItems", "maxItems"),
      ("minProperties", "maxProperties"),
    ] {
    if number(field(schema, pair.0)) is Some(lo) &&
      number(field(schema, pair.1)) is Some(hi) &&
      lo > hi {
      ctx.errors.push(path + ": lower bound exceeds upper bound")
    }
  }
  if has(schema, "enum") {
    match field(schema, "enum") {
      Array(a) =>
        if a.is_empty() {
          ctx.errors.push(path + ": enum must not be empty")
        }
      _ => ctx.errors.push(path + ": enum must be an array")
    }
  }
  if has(schema, "required") {
    match field(schema, "required") {
      Array(a) =>
        for v in a {
          match v {
            String(_) => ()
            _ => ctx.errors.push(path + ": required entries must be strings")
          }
        }
      _ => ctx.errors.push(path + ": required must be an array")
    }
  }
  let props = field(schema, "properties")
  for keyword in ["exclusiveMinimum", "exclusiveMaximum"] {
    let bound = if keyword == "exclusiveMinimum" {
      "minimum"
    } else {
      "maximum"
    }
    if yes(field(schema, keyword)) && !has(schema, bound) {
      ctx.errors.push(pointer(path, keyword) + ": requires " + bound)
    }
  }
  // Constraints on unrelated types are ignored by JSON Schema semantics. Keep
  // these unusual schemas out of a clean result rather than inferring types.
  for
    keyword in [
      "properties", "required", "additionalProperties", "minProperties", "maxProperties",
    ] {
    if has(schema, keyword) && t != "" && t != "object" {
      ctx.add(
        "warning",
        "CONSTRAINT_TYPE",
        op,
        pointer(path, keyword),
        "Object constraint on a non-object type requires review",
      )
    }
  }
  for
    keyword in [
      "minimum", "maximum", "multipleOf", "exclusiveMinimum", "exclusiveMaximum",
    ] {
    if has(schema, keyword) && t != "" && t != "number" && t != "integer" {
      ctx.add(
        "warning",
        "CONSTRAINT_TYPE",
        op,
        pointer(path, keyword),
        "Numeric constraint on a non-numeric type requires review",
      )
    }
  }
  if has(schema, "properties") && !is_object(props) {
    ctx.errors.push(path + ": properties must be an object")
  }
  for key in keys(props) {
    validate_schema(
      ctx,
      doc,
      field(props, key),
      op,
      pointer(pointer(path, "properties"), key),
      depth + 1,
    )
  }
  if has(schema, "items") {
    validate_schema(
      ctx,
      doc,
      field(schema, "items"),
      op,
      pointer(path, "items"),
      depth + 1,
    )
  }
  if t == "array" && !has(schema, "items") {
    ctx.errors.push(path + ": OpenAPI 3.0 array schemas require items")
  }
  if has(schema, "additionalProperties") {
    let ap = field(schema, "additionalProperties")
    if ap != Json::boolean(true) && ap != Json::boolean(false) {
      validate_schema(
        ctx,
        doc,
        ap,
        op,
        pointer(path, "additionalProperties"),
        depth + 1,
      )
    }
  }
}

///|
fn validate_content(
  ctx : Context,
  doc : Json,
  content : Json,
  op : String,
  path : String,
) -> Unit {
  if !is_object(content) {
    ctx.errors.push(path + ": content must be an object")
    return
  }
  for media in keys(content) {
    let value = field(content, media)
    let p = pointer(path, media)
    if !is_object(value) {
      ctx.errors.push(p + ": media type must be an object")
      continue
    }
    if has(value, "schema") {
      validate_schema(
        ctx,
        doc,
        field(value, "schema"),
        op,
        pointer(p, "schema"),
        0,
      )
    }
    if has(value, "encoding") {
      ctx.add(
        "warning",
        "UNSUPPORTED_ENCODING",
        op,
        pointer(p, "encoding"),
        "Media encoding semantics require review",
      )
    }
  }
}

///|
/// Merges Path Item parameters and operation overrides by (in,name).
fn parameters(
  ctx : Context,
  doc : Json,
  item : Json,
  operation : Json,
  op : String,
  path : String,
) -> Map[String, Json] {
  let result : Map[String, Json] = Map([])
  for owner in [item, operation] {
    if has(owner, "parameters") {
      match field(owner, "parameters") {
        Array(_) => ()
        _ => ctx.errors.push(path + ": parameters must be an array")
      }
    }
    let local_seen : Map[String, Bool] = Map([])
    for raw in arr(field(owner, "parameters")) {
      guard resolve(ctx, doc, raw, op, pointer(path, "parameters"))
        is Some(param) else {
        continue
      }
      let name = str(field(param, "name"))
      let location = str(field(param, "in"))
      if name == "" || !["query", "path", "header", "cookie"].contains(location) {
        ctx.errors.push(path + ": parameter requires name and valid in")
        continue
      }
      let normalized = if location == "header" { name.to_lower() } else { name }
      let key = location + ":" + normalized
      if local_seen.contains(key) {
        ctx.errors.push(path + ": duplicate parameter " + key)
      }
      local_seen[key] = true
      if location == "path" && !yes(field(param, "required")) {
        ctx.errors.push(path + ": path parameter must be required: " + name)
      }
      if has(param, "required") &&
        field(param, "required") != Json::boolean(true) &&
        field(param, "required") != Json::boolean(false) {
        ctx.errors.push(path + ": parameter required must be boolean")
      }
      if has(param, "schema") == has(param, "content") {
        ctx.errors.push(
          path + ": parameter needs exactly one of schema or content",
        )
      }
      if has(param, "schema") {
        validate_schema(
          ctx,
          doc,
          field(param, "schema"),
          op,
          pointer(pointer(path, "parameters"), key),
          0,
        )
      }
      if has(param, "content") {
        ctx.add(
          "warning",
          "PARAMETER_CONTENT",
          op,
          pointer(path, "parameters"),
          "Content-based parameter serialization is not supported",
        )
      }
      result[key] = param
    }
  }
  result
}

///|
fn methods() -> Array[String] {
  ["delete", "get", "head", "options", "patch", "post", "put", "trace"]
}

///|
fn validate_document(ctx : Context, doc : Json, side : String) -> Unit {
  if !is_object(doc) {
    ctx.errors.push(side + ": document must be an object")
    return
  }
  let version = str(field(doc, "openapi"))
  if !["3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.0.4"].contains(version) {
    ctx.errors.push(side + ": only OpenAPI 3.0.0–3.0.4 JSON is supported")
  }
  let info = field(doc, "info")
  if !is_object(info) ||
    str(field(info, "title")) == "" ||
    str(field(info, "version")) == "" {
    ctx.errors.push(side + ": info.title and info.version are required")
  }
  let paths = field(doc, "paths")
  if has(doc, "security") {
    validate_security(ctx, field(doc, "security"), side + "/security")
  }
  if !is_object(paths) {
    ctx.errors.push(side + ": paths must be an object")
    return
  }
  if has(doc, "security") && !arr(field(doc, "security")).is_empty() {
    ctx.add(
      "warning",
      "SECURITY_REVIEW",
      "document",
      "/security",
      "Authentication requirements require manual review (" + side + ")",
    )
  }
  for route in keys(paths) {
    if route.has_prefix("x-") {
      continue
    }
    if !route.has_prefix("/") {
      ctx.errors.push(side + ": path must start with /: " + route)
      continue
    }
    let p = pointer("/paths", route)
    let raw = field(paths, route)
    if has(raw, "$ref") {
      ctx.add(
        "warning", "PATH_ITEM_REF", route, p, "Path Item $ref merging is outside the supported subset",
      )
      continue
    }
    if !is_object(raw) {
      ctx.errors.push(side + p + ": Path Item must be an object")
      continue
    }
    for verb in methods() {
      if !has(raw, verb) {
        continue
      }
      let operation = field(raw, verb)
      let op = verb.to_upper() + " " + route
      let op_path = pointer(p, verb)
      if !is_object(operation) {
        ctx.errors.push(side + op_path + ": operation must be an object")
        continue
      }
      ignore(parameters(ctx, doc, raw, operation, op, op_path))
      if has(operation, "security") {
        validate_security(
          ctx,
          field(operation, "security"),
          side + pointer(op_path, "security"),
        )
      }
      if has(operation, "security") &&
        !arr(field(operation, "security")).is_empty() {
        ctx.add(
          "warning",
          "SECURITY_REVIEW",
          op,
          pointer(op_path, "security"),
          "Operation authentication requires manual review (" + side + ")",
        )
      }
      if has(operation, "callbacks") {
        ctx.add(
          "warning",
          "CALLBACK_REVIEW",
          op,
          pointer(op_path, "callbacks"),
          "Callbacks are outside the supported subset",
        )
      }
      if has(operation, "requestBody") {
        if resolve(
            ctx,
            doc,
            field(operation, "requestBody"),
            op,
            pointer(op_path, "requestBody"),
          )
          is Some(body) {
          if !is_object(body) {
            ctx.errors.push(op_path + ": requestBody must be an object")
          }
          if has(body, "required") &&
            field(body, "required") != Json::boolean(true) &&
            field(body, "required") != Json::boolean(false) {
            ctx.errors.push(op_path + ": requestBody.required must be boolean")
          }
          validate_content(
            ctx,
            doc,
            field(body, "content"),
            op,
            pointer(pointer(op_path, "requestBody"), "content"),
          )
        }
      }
      let responses = field(operation, "responses")
      if !is_object(responses) || keys(responses).is_empty() {
        ctx.errors.push(
          side + op_path + ": responses must be a nonempty object",
        )
      }
      for status in keys(responses) {
        if status.has_prefix("x-") {
          continue
        }
        let rp = pointer(pointer(op_path, "responses"), status)
        if status == "default" || status.contains("X") {
          ctx.add(
            "warning", "RESPONSE_RANGE", op, rp, "Default and status-range response matching require review",
          )
        }
        guard resolve(ctx, doc, field(responses, status), op, rp)
          is Some(response) else {
          continue
        }
        if !is_object(response) || !has(response, "description") {
          ctx.errors.push(side + rp + ": response object requires description")
        }
        if has(response, "content") {
          validate_content(
            ctx,
            doc,
            field(response, "content"),
            op,
            pointer(rp, "content"),
          )
        }
        if has(response, "headers") &&
          !keys(field(response, "headers")).is_empty() {
          ctx.add(
            "warning",
            "RESPONSE_HEADERS",
            op,
            pointer(rp, "headers"),
            "Response header contracts require review",
          )
        }
        if has(response, "links") {
          ctx.add(
            "warning",
            "RESPONSE_LINKS",
            op,
            pointer(rp, "links"),
            "Response links require review",
          )
        }
      }
    }
  }
}
