///|
/// One actionable finding. Locations use escaped logical JSON Pointer segments;
/// parameters are keyed by in:name and references are shown at their use site.
pub(all) struct Finding {
  severity : String
  rule : String
  operation : String
  location : String
  message : String
} derive(ToJson)

///|
pub extend Finding with ToJson::{to_json}

///|
/// complete=false means the supported subset cannot establish compatibility.
pub(all) struct Report {
  version : String
  status : String
  complete : Bool
  breaking_count : Int
  warning_count : Int
  findings : Array[Finding]
  errors : Array[String]
} derive(ToJson)

///|
pub extend Report with ToJson::{to_json}

///|
priv struct Context {
  findings : Array[Finding]
  errors : Array[String]
  seen : Map[String, Bool]
  mut visits : Int
}

///|
/// Bound traversal work even for branching recursive reference graphs.
fn Context::budget(self : Context) -> Bool {
  self.visits += 1
  if self.visits > 5000 {
    self.add(
      "warning", "WORK_LIMIT", "document", "", "Schema traversal budget exceeded; analysis is incomplete",
    )
    false
  } else {
    true
  }
}

///|
fn Context::add(
  self : Context,
  severity : String,
  rule : String,
  op : String,
  path : String,
  message : String,
) -> Unit {
  let key = severity + "|" + rule + "|" + op + "|" + path + "|" + message
  if !self.seen.contains(key) {
    self.seen[key] = true
    self.findings.push({
      severity,
      rule,
      operation: op,
      location: path,
      message,
    })
  }
}

///|
fn field(value : Json, key : String) -> Json {
  match value {
    Object(m) => m.get(key).unwrap_or(Json::null())
    _ => Json::null()
  }
}

///|
fn has(value : Json, key : String) -> Bool {
  match value {
    Object(m) => m.contains(key)
    _ => false
  }
}

///|
fn str(value : Json) -> String {
  match value {
    String(s) => s
    _ => ""
  }
}

///|
fn yes(value : Json) -> Bool {
  match value {
    True => true
    _ => false
  }
}

///|
fn arr(value : Json) -> Array[Json] {
  match value {
    Array(a) => a
    _ => []
  }
}

///|
fn keys(value : Json) -> Array[String] {
  match value {
    Object(m) => {
      let a = m.keys().to_array()
      a.sort()
      a
    }
    _ => []
  }
}

///|
fn is_object(value : Json) -> Bool {
  match value {
    Object(_) => true
    _ => false
  }
}

///|
fn pointer(path : String, key : String) -> String {
  path + "/" + key.replace_all(old="~", new="~0").replace_all(old="/", new="~1")
}

///|
fn contains_value(values : Json, value : Json) -> Bool {
  arr(values).contains(value)
}

///|
fn required(schema : Json, key : String) -> Bool {
  contains_value(field(schema, "required"), Json::string(key))
}

///|
/// Object keys do not affect semantic equality; arrays retain their order.
fn same(a : Json, b : Json) -> Bool {
  a == b
}

///|
fn number(value : Json) -> Double? {
  match value {
    Number(n, ..) => Some(n)
    _ => None
  }
}
