//! FeedbackKit for Tauri.
//!
//! The in-app feedback flow itself — capture, annotation, the composer,
//! submission, "is it fixed?" — is FeedbackKit's web SDK running in your
//! webview (`feedbackkit-tauri` on npm wraps it). This plugin adds what a
//! webview can't know or do on its own:
//!
//! - the real OS version, machine model and app identifier/version, attached
//!   to every report (`environment.runtime: "tauri"`), and
//! - a native "Report a Problem…" menu item (and [`present`] for trays or
//!   global shortcuts) that opens the flow in the focused window.
//!
//! ```no_run
//! tauri::Builder::default()
//!     .plugin(tauri_plugin_feedbackkit::init())
//!     .setup(|app| {
//!         let report = tauri_plugin_feedbackkit::menu_item(app)?;
//!         let help = tauri::menu::Submenu::with_items(app, "Help", true, &[&report])?;
//!         app.set_menu(tauri::menu::Menu::with_items(app, &[&help])?)?;
//!         Ok(())
//!     });
//! ```
//!
//! Add `"feedbackkit:default"` to your capability's permissions.

use tauri::{
    menu::MenuItem,
    plugin::{Builder, TauriPlugin},
    AppHandle, Emitter, Manager, Runtime,
};

mod environment;

pub use environment::DesktopEnvironment;

/// The id of [`menu_item`]'s menu item; clicks on it open the flow.
pub const MENU_ITEM_ID: &str = "feedbackkit-report";

/// The event `feedbackkit-tauri` listens for to open the flow.
pub const PRESENT_EVENT: &str = "feedbackkit://present";

#[tauri::command]
fn environment<R: Runtime>(app: AppHandle<R>) -> DesktopEnvironment {
    environment::collect(&app)
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("feedbackkit")
        .invoke_handler(tauri::generate_handler![environment])
        .setup(|app, _api| {
            app.on_menu_event(|app, event| {
                if event.id() == MENU_ITEM_ID {
                    let _ = present(app);
                }
            });
            Ok(())
        })
        .build()
}

/// Opens the feedback flow in the focused window (or the first one), e.g.
/// from a tray menu or a global shortcut.
pub fn present<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let windows = app.webview_windows();
    let target = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    match target {
        Some(window) => window.emit(PRESENT_EVENT, ()),
        None => Ok(()),
    }
}

/// A "Report a Problem…" menu item (⌘⇧F / Ctrl+Shift+F) for your Help menu
/// or tray; the plugin handles its clicks.
pub fn menu_item<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(manager, MENU_ITEM_ID, "Report a Problem…", true, Some("CmdOrCtrl+Shift+F"))
}
