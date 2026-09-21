///| Resolve local JSON Pointer references only. Cycles and external refs are

///|
/// explicit coverage gaps, never silently interpreted as an empty schema.
fn resolve(
  ctx : Context,
  doc : Json,
  value : Json,
  op : String,
  path : String,
) -> Json? {
  let mut current = value
  let visited : Map[String, Bool] = Map([])
  for _ in 0..<64 {
    if !has(current, "$ref") {
      return Some(current)
    }
    let ref_value = field(current, "$ref")
    let reference = str(ref_value)
    if reference == "" {
      ctx.errors.push(path + ": $ref must be a nonempty string")
      return None
    }
    if !reference.has_prefix("#/") {
      ctx.add(
        "warning",
        "UNSUPPORTED_REF",
        op,
        path,
        "Only local #/ JSON Pointer references are supported: " + reference,
      )
      return None
    }
    if reference.contains("%") {
      ctx.add(
        "warning",
        "UNSUPPORTED_REF",
        op,
        path,
        "Percent-encoded reference fragments are not supported: " + reference,
      )
      return None
    }
    if visited.contains(reference) {
      ctx.add(
        "warning",
        "CYCLIC_REF",
        op,
        path,
        "Reference-only cycle: " + reference,
      )
      return None
    }
    visited[reference] = true
    let parts = reference.split("/").to_array()
    let mut target = doc
    for i in 1..<parts.length() {
      let raw = parts[i].to_owned()
      // RFC 6901 escapes must be decoded in this order.
      let residual = raw
        .replace_all(old="~1", new="")
        .replace_all(old="~0", new="")
      if residual.contains("~") {
        ctx.errors.push(path + ": invalid JSON Pointer escape in " + reference)
        return None
      }
      let token = raw
        .replace_all(old="~1", new="/")
        .replace_all(old="~0", new="~")
      if !has(target, token) {
        ctx.errors.push(path + ": unresolved object reference " + reference)
        return None
      }
      target = field(target, token)
    }
    current = target
  }
  ctx.add("warning", "REF_LIMIT", op, path, "Reference chain exceeds 64 steps")
  None
}

///|
fn union_keys(a : Json, b : Json) -> Array[String] {
  let result = keys(a)
  for key in keys(b) {
    if !result.contains(key) {
      result.push(key)
    }
  }
  result.sort()
  result
}

///|
fn additional(schema : Json) -> Json {
  if has(schema, "additionalProperties") {
    field(schema, "additionalProperties")
  } else {
    Json::boolean(true)
  }
}

///|
fn property_schema(schema : Json, name : String) -> Json {
  let properties = field(schema, "properties")
  if has(properties, name) {
    field(properties, name)
  } else {
    additional(schema)
  }
}

///|
fn unconstrained(schema : Json) -> Bool {
  if schema == Json::boolean(true) {
    return true
  }
  let meaningful = [
    "type", "enum", "properties", "required", "items", "additionalProperties", "minimum",
    "maximum", "minLength", "maxLength", "minItems", "maxItems", "minProperties",
    "maxProperties", "pattern", "format", "multipleOf", "allOf", "anyOf", "oneOf",
    "not",
  ]
  !meaningful.any(k => has(schema, k))
}
