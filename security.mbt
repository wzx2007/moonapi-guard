///| Authentication compatibility is not decided in v0.1, but malformed

///|
/// requirements must not masquerade as an empty (anonymous) requirement.
fn validate_security(ctx : Context, value : Json, path : String) -> Unit {
  match value {
    Array(requirements) =>
      for item in requirements {
        if !is_object(item) {
          ctx.errors.push(path + ": security requirement must be an object")
          continue
        }
        for name in keys(item) {
          match field(item, name) {
            Array(scopes) =>
              for scope in scopes {
                match scope {
                  String(_) => ()
                  _ =>
                    ctx.errors.push(path + ": security scopes must be strings")
                }
              }
            _ =>
              ctx.errors.push(path + ": security scheme scopes must be arrays")
          }
        }
      }
    _ => ctx.errors.push(path + ": security must be an array")
  }
}
