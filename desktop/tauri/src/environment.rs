//! OS name/version and machine model, read the way each OS exposes them —
//! the details a webview's user agent can't give (Windows 11 vs 10, the Linux
//! distribution, "MacBookPro18,3"). Mirrors desktop/electron/src/environment.ts.

use serde::Serialize;
use tauri::{AppHandle, Runtime};

/// Merged over what the web SDK detects (`FeedbackKit.environment`). Field
/// names match `EnvironmentOverrides` in feedbackkit-web.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEnvironment {
    pub os_name: String,
    pub os_version: String,
    pub device_model: String,
    pub app_version: String,
    pub app_build: String,
    pub bundle_identifier: String,
    pub runtime: &'static str,
    pub runtime_version: &'static str,
}

pub fn collect<R: Runtime>(app: &AppHandle<R>) -> DesktopEnvironment {
    let info = os_info::get();
    let (os_name, os_version) = os_name_and_version(&info);
    let version = app.package_info().version.to_string();
    DesktopEnvironment {
        os_name,
        os_version,
        device_model: device_model().unwrap_or_else(|| format!("PC ({})", std::env::consts::ARCH)),
        app_build: version.clone(),
        app_version: version,
        bundle_identifier: app.config().identifier.clone(),
        runtime: "tauri",
        runtime_version: tauri::VERSION,
    }
}

fn os_name_and_version(info: &os_info::Info) -> (String, String) {
    let version = info.version().to_string();
    match info.os_type() {
        os_info::Type::Windows => ("Windows".into(), windows_version(&version)),
        os_info::Type::Macos => ("macOS".into(), version),
        // Every Linux distribution reports as "Linux", with the distribution in the version.
        other => {
            let distribution = other.to_string();
            let version = if version == "Unknown" { String::new() } else { version };
            ("Linux".into(), format!("{distribution} {version}").trim().to_string())
        }
    }
}

/// "10.0.26100" → "11 (26100)": Windows 11 still reports NT 10.0, with build 22000+.
pub fn windows_version(release: &str) -> String {
    let parts: Vec<&str> = release.split('.').collect();
    match (parts.first(), parts.get(2).and_then(|b| b.parse::<u32>().ok())) {
        (Some(&"10"), Some(build)) if build >= 22000 => format!("11 ({build})"),
        (Some(&"10"), Some(build)) => format!("10 ({build})"),
        _ => release.to_string(),
    }
}

// Unused on macOS, where hw.model already names the machine.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn join_vendor(vendor: &str, product: &str) -> Option<String> {
    let product = product.trim();
    let vendor = vendor.trim();
    if product.is_empty() {
        return None;
    }
    Some(if vendor.is_empty() || product.starts_with(vendor) { product.to_string() } else { format!("{vendor} {product}") })
}

#[cfg(target_os = "macos")]
fn device_model() -> Option<String> {
    let output = std::process::Command::new("sysctl").args(["-n", "hw.model"]).output().ok()?;
    let model = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!model.is_empty()).then_some(model)
}

#[cfg(target_os = "linux")]
fn device_model() -> Option<String> {
    let read = |name: &str| std::fs::read_to_string(format!("/sys/class/dmi/id/{name}")).unwrap_or_default();
    join_vendor(&read("sys_vendor"), &read("product_name"))
}

#[cfg(target_os = "windows")]
fn device_model() -> Option<String> {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let bios = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("HARDWARE\\DESCRIPTION\\System\\BIOS").ok()?;
    let vendor: String = bios.get_value("SystemManufacturer").unwrap_or_default();
    let product: String = bios.get_value("SystemProductName").unwrap_or_default();
    join_vendor(&vendor, &product)
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn device_model() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_11_is_told_from_10_by_build() {
        assert_eq!(windows_version("10.0.26100"), "11 (26100)");
        assert_eq!(windows_version("10.0.22000"), "11 (22000)");
        assert_eq!(windows_version("10.0.19045"), "10 (19045)");
        assert_eq!(windows_version("6.1.7601"), "6.1.7601");
    }

    #[test]
    fn vendor_is_prefixed_once() {
        assert_eq!(join_vendor("LENOVO", "21HM"), Some("LENOVO 21HM".into()));
        assert_eq!(join_vendor("Microsoft Corporation", "Microsoft Corporation Surface"), Some("Microsoft Corporation Surface".into()));
        assert_eq!(join_vendor("", "Surface Laptop 7"), Some("Surface Laptop 7".into()));
        assert_eq!(join_vendor("Dell", " "), None);
    }

    #[test]
    fn this_machine_has_details() {
        let (name, version) = os_name_and_version(&os_info::get());
        assert!(!name.is_empty());
        assert!(!version.is_empty());
    }
}
