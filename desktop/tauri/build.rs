const COMMANDS: &[&str] = &["environment"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
