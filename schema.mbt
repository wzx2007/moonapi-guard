///| Checks source values are a subset of destination values. For requests,

///|
/// source=old and destination=new. For responses the direction is reversed.
fn schema_subset(
  ctx : Context,
  source_doc : Json,
  target_doc : Json,
  source : Json,
  target : Json,
  op : String,
  path : String,
  direction : String,
  depth : Int,
) -> Unit {
  if !ctx.budget() {
    return
  }
  if depth > 48 {
    ctx.add(
      "warning", "SCHEMA_DEPTH", op, path, "Recursive or deeply nested schema exceeds the comparison depth limit",
    )
    return
  }
  guard resolve(ctx, source_doc, source, op, path) is Some(src) else { return }
  guard resolve(ctx, target_doc, target, op, path) is Some(dst) else { return }
  if src == Json::boolean(false) || dst == Json::boolean(true) {
    return
  }
  if dst == Json::boolean(false) {
    ctx.add(
      "breaking",
      "SCHEMA_FORBIDDEN",
      op,
      path,
      direction +
      ": values previously permitted on this side are forbidden by the receiving contract",
    )
    return
  }
  if unconstrained(dst) {
    return
  }
  // Unsupported schema semantics are surfaced by validation. Do not guess an
  // inclusion relation when a composition/visibility construct participates.
  let complex = [
    "allOf", "anyOf", "oneOf", "not", "readOnly", "writeOnly", "discriminator",
  ]
  if complex.any(k => has(src, k) || has(dst, k)) {
    return
  }
  let st = str(field(src, "type"))
  let dt = str(field(dst, "type"))
  if dt != "" && st != dt && !(st == "integer" && dt == "number") {
    ctx.add(
      "breaking",
      "TYPE_INCOMPATIBLE",
      op,
      pointer(path, "type"),
      direction +
      ": source type '" +
      (if st == "" { "unconstrained" } else { st }) +
      "' is not accepted by target type '" +
      dt +
      "'",
    )
    return
  }
  if st != "" &&
    yes(field(src, "nullable")) &&
    dt != "" &&
    !yes(field(dst, "nullable")) {
    ctx.add(
      "breaking",
      "NULLABILITY",
      op,
      pointer(path, "nullable"),
      direction +
      ": null is possible in the source but not accepted by the target",
    )
  }
  if has(dst, "enum") {
    if !has(src, "enum") ||
      arr(field(src, "enum")).any(v => !contains_value(field(dst, "enum"), v)) {
      ctx.add(
        "breaking",
        "ENUM_INCOMPATIBLE",
        op,
        pointer(path, "enum"),
        direction + ": source values are not covered by the target enum",
      )
    }
  }
  // For finite enums these bound checks are conservative, so mark coverage
  // incomplete rather than claiming a concrete violation without a witness.
  for
    keyword in [
      "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "minProperties",
      "maxProperties",
    ] {
    guard number(field(dst, keyword)) is Some(bound) else { continue }
    let lower = keyword.has_prefix("min")
    let restricts = match number(field(src, keyword)) {
      Some(old_bound) =>
        if lower {
          bound > old_bound
        } else {
          bound < old_bound
        }
      None => true
    }
    if restricts {
      if has(src, "enum") {
        ctx.add(
          "warning",
          "ENUM_BOUND_REVIEW",
          op,
          pointer(path, keyword),
          direction +
          ": bound changed on an enum; finite-value satisfiability requires review",
        )
      } else {
        ctx.add(
          "breaking",
          "BOUND_INCOMPATIBLE",
          op,
          pointer(path, keyword),
          direction + ": " + keyword + " narrows the receiving contract",
        )
      }
    }
  }
  for keyword in ["exclusiveMinimum", "exclusiveMaximum"] {
    let bound_name = if keyword == "exclusiveMinimum" {
      "minimum"
    } else {
      "maximum"
    }
    if yes(field(dst, keyword)) &&
      !yes(field(src, keyword)) &&
      same(field(src, bound_name), field(dst, bound_name)) {
      ctx.add(
        "breaking",
        "EXCLUSIVE_BOUND",
        op,
        pointer(path, keyword),
        direction + ": inclusive boundary becomes exclusive",
      )
    }
  }
  for keyword in ["pattern", "format", "multipleOf"] {
    if has(dst, keyword) && !same(field(src, keyword), field(dst, keyword)) {
      ctx.add(
        "warning",
        "CONSTRAINT_REVIEW",
        op,
        pointer(path, keyword),
        direction + ": changed " + keyword + " requires semantic review",
      )
    }
  }
  if yes(field(dst, "uniqueItems")) && !yes(field(src, "uniqueItems")) {
    ctx.add(
      "breaking",
      "UNIQUE_ITEMS",
      op,
      pointer(path, "uniqueItems"),
      direction + ": duplicate array elements may no longer be accepted",
    )
  }
  let sp = field(src, "properties")
  let dp = field(dst, "properties")
  if st == "object" || dt == "object" || is_object(sp) || is_object(dp) {
    for item in arr(field(dst, "required")) {
      let name = str(item)
      if !required(src, name) {
        ctx.add(
          "breaking",
          "REQUIRED_PROPERTY",
          op,
          pointer(pointer(path, "properties"), name),
          direction +
          ": target requires property '" +
          name +
          "' but the source does not guarantee it",
        )
      }
    }
    for name in union_keys(sp, dp) {
      schema_subset(
        ctx,
        source_doc,
        target_doc,
        property_schema(src, name),
        property_schema(dst, name),
        op,
        pointer(pointer(path, "properties"), name),
        direction,
        depth + 1,
      )
    }
    schema_subset(
      ctx,
      source_doc,
      target_doc,
      additional(src),
      additional(dst),
      op,
      pointer(path, "additionalProperties"),
      direction,
      depth + 1,
    )
  }
  if st == "array" || dt == "array" {
    schema_subset(
      ctx,
      source_doc,
      target_doc,
      if has(src, "items") {
        field(src, "items")
      } else {
        Json::boolean(true)
      },
      if has(dst, "items") {
        field(dst, "items")
      } else {
        Json::boolean(true)
      },
      op,
      pointer(path, "items"),
      direction,
      depth + 1,
    )
  }
}
