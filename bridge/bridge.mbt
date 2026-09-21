///|
/// Browser and Node share the same MoonBit compatibility engine.
pub fn analyze(old_text : String, new_text : String) -> String {
  @guard.compare_text(old_text, new_text).to_json().stringify()
}
