///|
/// Compare two JSON documents without file or network I/O.
#warnings("-20")
pub fn compare_text(old_text : String, new_text : String) -> Report {
  let ctx : Context = { findings: [], errors: [], seen: Map([]), visits: 0, }
  if old_text.length() > 2000000 || new_text.length() > 2000000 {
    ctx.errors.push("Input exceeds the two-million-character limit")
    return finish(ctx)
  }
  let old_doc = @json.parse(old_text, max_nesting_depth=96) catch {
    e => {
      ctx.errors.push("old: " + e.to_string())
      return finish(ctx)
    }
  }
  let new_doc = @json.parse(new_text, max_nesting_depth=96) catch {
    e => {
      ctx.errors.push("new: " + e.to_string())
      return finish(ctx)
    }
  }
  validate_document(ctx, old_doc, "old")
  validate_document(ctx, new_doc, "new")
  if !ctx.errors.is_empty() {
    return finish(ctx)
  }
  compare_paths(ctx, old_doc, new_doc)
  finish(ctx)
}

///|
fn finish(ctx : Context) -> Report {
  let breaking = ctx.findings.filter(f => f.severity == "breaking").length()
  let warnings = ctx.findings.filter(f => f.severity == "warning").length()
  let status = if !ctx.errors.is_empty() {
    "invalid"
  } else if breaking > 0 {
    "breaking"
  } else if warnings > 0 {
    "incomplete"
  } else {
    "compatible"
  }
  {
    version: "0.1.0",
    status,
    complete: warnings == 0 && ctx.errors.is_empty(),
    breaking_count: breaking,
    warning_count: warnings,
    findings: ctx.findings,
    errors: ctx.errors,
  }
}

///|
fn compare_paths(ctx : Context, old_doc : Json, new_doc : Json) -> Unit {
  if !same(field(old_doc, "servers"), field(new_doc, "servers")) {
    ctx.add(
      "warning", "SERVERS_CHANGED", "document", "/servers", "Server URL or variable changes require deployment review",
    )
  }
  let old_paths = field(old_doc, "paths")
  let new_paths = field(new_doc, "paths")
  for route in keys(old_paths) {
    if route.has_prefix("x-") {
      continue
    }
    let old_item = field(old_paths, route)
    let new_item = field(new_paths, route)
    if has(old_item, "$ref") || has(new_item, "$ref") {
      continue
    }
    for verb in methods() {
      if !has(old_item, verb) {
        continue
      }
      let op = verb.to_upper() + " " + route
      let path = pointer(pointer("/paths", route), verb)
      if !has(new_item, verb) {
        ctx.add(
          "breaking", "OPERATION_REMOVED", op, path, "An existing operation is no longer declared",
        )
        continue
      }
      let old_op = field(old_item, verb)
      let new_op = field(new_item, verb)
      if !same(field(old_item, "servers"), field(new_item, "servers")) ||
        !same(field(old_op, "servers"), field(new_op, "servers")) {
        ctx.add(
          "warning", "SERVERS_CHANGED", op, path, "Operation or path server changes require deployment review",
        )
      }
      if !same(field(old_op, "operationId"), field(new_op, "operationId")) {
        ctx.add(
          "warning",
          "OPERATION_ID_CHANGED",
          op,
          pointer(path, "operationId"),
          "Generated SDK verb names may change",
        )
      }
      compare_parameters(
        ctx, old_doc, new_doc, old_item, new_item, old_op, new_op, op, path,
      )
      compare_body(ctx, old_doc, new_doc, old_op, new_op, op, path)
      compare_responses(ctx, old_doc, new_doc, old_op, new_op, op, path)
    }
  }
}

///|
fn parameter_style(param : Json) -> String {
  if has(param, "style") {
    str(field(param, "style"))
  } else if ["query", "cookie"].contains(str(field(param, "in"))) {
    "form"
  } else {
    "simple"
  }
}

///|
fn parameter_explode(param : Json) -> Bool {
  if has(param, "explode") {
    yes(field(param, "explode"))
  } else {
    parameter_style(param) == "form"
  }
}

///|
fn compare_parameters(
  ctx : Context,
  old_doc : Json,
  new_doc : Json,
  old_item : Json,
  new_item : Json,
  old_op : Json,
  new_op : Json,
  op : String,
  path : String,
) -> Unit {
  let old_params = parameters(ctx, old_doc, old_item, old_op, op, path)
  let new_params = parameters(ctx, new_doc, new_item, new_op, op, path)
  let names = new_params.keys().to_array()
  names.sort()
  for name in names {
    let newer = new_params[name]
    let p = pointer(pointer(path, "parameters"), name)
    match old_params.get(name) {
      None =>
        if yes(field(newer, "required")) {
          ctx.add(
            "breaking",
            "PARAMETER_REQUIRED",
            op,
            p,
            "New required parameter: " + name,
          )
        }
      Some(older) => {
        if !yes(field(older, "required")) && yes(field(newer, "required")) {
          ctx.add(
            "breaking",
            "PARAMETER_REQUIRED",
            op,
            p,
            "Optional parameter becomes required: " + name,
          )
        }
        if has(older, "schema") && has(newer, "schema") {
          schema_subset(
            ctx,
            old_doc,
            new_doc,
            field(older, "schema"),
            field(newer, "schema"),
            op,
            pointer(p, "schema"),
            "request",
            0,
          )
        }
        if parameter_style(older) != parameter_style(newer) ||
          parameter_explode(older) != parameter_explode(newer) ||
          yes(field(older, "allowReserved")) !=
          yes(field(newer, "allowReserved")) ||
          yes(field(older, "allowEmptyValue")) !=
          yes(field(newer, "allowEmptyValue")) {
          ctx.add(
            "warning", "SERIALIZATION_CHANGED", op, p, "Parameter wire serialization changed",
          )
        }
        if !same(
            field(field(older, "schema"), "default"),
            field(field(newer, "schema"), "default"),
          ) {
          ctx.add(
            "warning", "DEFAULT_CHANGED", op, p, "Parameter default changed; behavior needs review",
          )
        }
      }
    }
  }
  let old_names = old_params.keys().to_array()
  old_names.sort()
  for name in old_names {
    if !new_params.contains(name) {
      ctx.add(
        "warning",
        "PARAMETER_REMOVED",
        op,
        pointer(pointer(path, "parameters"), name),
        "Parameter removed; whether old requests are ignored or rejected depends on server behavior",
      )
    }
  }
}

///|
fn compare_content(
  ctx : Context,
  old_doc : Json,
  new_doc : Json,
  old_content : Json,
  new_content : Json,
  op : String,
  path : String,
  request : Bool,
) -> Unit {
  if !request {
    for media in keys(old_content) {
      if !has(new_content, media) {
        ctx.add(
          "warning",
          "RESPONSE_MEDIA_REMOVED",
          op,
          pointer(path, media),
          "Response media type removed; clients negotiating this media type need review",
        )
      }
    }
  }
  // Requests: old media must remain accepted. Responses: newly emitted media
  // must be understood by old clients. Wildcards are conservatively reviewed.
  let source = if request { old_content } else { new_content }
  let target = if request { new_content } else { old_content }
  for media in keys(source) {
    let p = pointer(path, media)
    if media.contains("*") || keys(target).any(k => k.contains("*")) {
      ctx.add(
        "warning", "MEDIA_WILDCARD", op, p, "Wildcard media matching requires review",
      )
      continue
    }
    if !has(target, media) {
      ctx.add(
        "breaking",
        "MEDIA_TYPE_INCOMPATIBLE",
        op,
        p,
        if request {
          "Previously accepted request media type removed"
        } else {
          "New response media type is not declared by the old contract"
        },
      )
      continue
    }
    let old_media = field(old_content, media)
    let new_media = field(new_content, media)
    let os = if has(old_media, "schema") {
      field(old_media, "schema")
    } else {
      Json::boolean(true)
    }
    let ns = if has(new_media, "schema") {
      field(new_media, "schema")
    } else {
      Json::boolean(true)
    }
    if request {
      schema_subset(
        ctx,
        old_doc,
        new_doc,
        os,
        ns,
        op,
        pointer(p, "schema"),
        "request",
        0,
      )
    } else {
      schema_subset(
        ctx,
        new_doc,
        old_doc,
        ns,
        os,
        op,
        pointer(p, "schema"),
        "response",
        0,
      )
    }
  }
}

///|
fn compare_body(
  ctx : Context,
  old_doc : Json,
  new_doc : Json,
  old_op : Json,
  new_op : Json,
  op : String,
  path : String,
) -> Unit {
  let p = pointer(path, "requestBody")
  if !has(old_op, "requestBody") {
    if has(new_op, "requestBody") {
      if resolve(ctx, new_doc, field(new_op, "requestBody"), op, p)
        is Some(body) &&
        yes(field(body, "required")) {
        ctx.add(
          "breaking", "BODY_REQUIRED", op, p, "A request body is now required",
        )
      }
    }
    return
  }
  if !has(new_op, "requestBody") {
    ctx.add(
      "warning", "BODY_REMOVED", op, p, "Request body contract removed; old-body handling requires review",
    )
    return
  }
  guard resolve(ctx, old_doc, field(old_op, "requestBody"), op, p)
    is Some(old_body) else {
    return
  }
  guard resolve(ctx, new_doc, field(new_op, "requestBody"), op, p)
    is Some(new_body) else {
    return
  }
  if !yes(field(old_body, "required")) && yes(field(new_body, "required")) {
    ctx.add(
      "breaking", "BODY_REQUIRED", op, p, "Optional request body becomes required",
    )
  }
  compare_content(
    ctx,
    old_doc,
    new_doc,
    field(old_body, "content"),
    field(new_body, "content"),
    op,
    pointer(p, "content"),
    true,
  )
}

///|
fn compare_responses(
  ctx : Context,
  old_doc : Json,
  new_doc : Json,
  old_op : Json,
  new_op : Json,
  op : String,
  path : String,
) -> Unit {
  let older = field(old_op, "responses")
  let newer = field(new_op, "responses")
  for status in union_keys(older, newer) {
    if status.has_prefix("x-") {
      continue
    }
    let p = pointer(pointer(path, "responses"), status)
    if !has(older, status) {
      ctx.add(
        "warning", "RESPONSE_STATUS_ADDED", op, p, "New response status; old-client fallback behavior requires review",
      )
      continue
    }
    if !has(newer, status) {
      ctx.add(
        "warning", "RESPONSE_STATUS_REMOVED", op, p, "Response status removed; behavioral and SDK compatibility requires review",
      )
      continue
    }
    guard resolve(ctx, old_doc, field(older, status), op, p)
      is Some(old_response) else {
      continue
    }
    guard resolve(ctx, new_doc, field(newer, status), op, p)
      is Some(new_response) else {
      continue
    }
    let oc = field(old_response, "content")
    let nc = field(new_response, "content")
    if !keys(oc).is_empty() && keys(nc).is_empty() {
      ctx.add(
        "breaking",
        "RESPONSE_BODY_REMOVED",
        op,
        pointer(p, "content"),
        "Previously described response body is no longer declared",
      )
    } else {
      compare_content(
        ctx,
        old_doc,
        new_doc,
        oc,
        nc,
        op,
        pointer(p, "content"),
        false,
      )
    }
  }
}
