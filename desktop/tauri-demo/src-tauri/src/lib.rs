use tauri::{
    menu::{Menu, Submenu},
    Manager,
};

/// The endpoint the end-to-end self-test posts to (e2e/selftest.mjs sets it), if any.
#[tauri::command]
fn selftest_endpoint() -> Option<String> {
    println!("FEEDBACKKIT_SELFTEST_LOG frontend asked for the endpoint");
    std::env::var("FEEDBACKKIT_DEMO_SELFTEST").ok().filter(|value| !value.is_empty())
}

/// Progress lines from the self-test, so a stuck run shows where it stopped.
#[tauri::command]
fn selftest_log(message: String) {
    println!("FEEDBACKKIT_SELFTEST_LOG {message}");
}

/// What the Help-menu item does (the plugin's menu handler calls the same
/// function), so the self-test can check the native trigger path.
#[tauri::command]
fn selftest_present(app: tauri::AppHandle) -> Result<(), String> {
    tauri_plugin_feedbackkit::present(&app).map_err(|error| error.to_string())
}

/// Ends a self-test run: prints the outcome and exits with its status.
#[tauri::command]
fn selftest_finish(app: tauri::AppHandle, ok: bool, message: String) {
    println!("FEEDBACKKIT_SELFTEST {} {message}", if ok { "PASS" } else { "FAIL" });
    app.exit(if ok { 0 } else { 1 });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // FeedbackKit, part 1 of 2 (part 2 is configure() in src/main.ts):
        // the plugin supplies OS/device/app details and handles its menu item.
        .plugin(tauri_plugin_feedbackkit::init())
        .invoke_handler(tauri::generate_handler![selftest_endpoint, selftest_log, selftest_present, selftest_finish])
        .setup(|app| {
            let menu = Menu::default(app.handle())?;
            let report = tauri_plugin_feedbackkit::menu_item(app)?;
            menu.append(&Submenu::with_items(app, "Help", true, &[&report])?)?;
            app.set_menu(menu)?;
            // A window that launches behind the terminal gets its timers
            // throttled by WebKit, which stalls an unattended self-test.
            if selftest_endpoint().is_some() {
                if let Some(window) = app.get_webview_window("main") {
                    window.set_always_on_top(true)?;
                    window.set_focus()?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the FeedbackKit Tauri demo");
}
