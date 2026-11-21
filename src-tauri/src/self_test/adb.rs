use std::path::{Path, PathBuf};
use std::time::Duration;

use super::*;

pub fn resolve_adb_path(custom: Option<&str>) -> Option<PathBuf> {
    if let Some(raw) = custom.map(str::trim).filter(|s| !s.is_empty()) {
        let p = PathBuf::from(raw);
        return p.is_file().then_some(p);
    }

    let exe_name = if cfg!(windows) { "adb.exe" } else { "adb" };

    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            let candidate = dir.join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    for env_key in ["ANDROID_SDK_ROOT", "ANDROID_HOME"] {
        if let Some(root) = std::env::var_os(env_key) {
            let candidate = PathBuf::from(root).join("platform-tools").join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local).join("Android");
        for sub in ["platform-tools", "Sdk/platform-tools"] {
            let candidate = base.join(sub).join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

pub async fn run_adb(adb: &Path, args: &[&str]) -> Result<String, String> {
    use tokio::process::Command;

    let mut cmd = Command::new(adb);
    cmd.args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = tokio::time::timeout(Duration::from_secs(ADB_TIMEOUT_SECS), cmd.output())
        .await
        .map_err(|_| "adb command timed out".to_owned())?
        .map_err(|e| format!("failed to run adb: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if err.is_empty() {
            format!("adb exited with {}", output.status)
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn parse_adb_devices(raw: &str) -> Vec<AdbDevice> {
    let mut devices = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("List of devices") || trimmed.starts_with('*')
        {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        let Some(serial) = parts.next() else {
            continue;
        };
        let Some(state) = parts.next() else {
            continue;
        };
        let mut model = String::new();
        let mut product = String::new();
        let mut device = String::new();
        for token in parts {
            if let Some(v) = token.strip_prefix("model:") {
                model = v.replace('_', " ");
            } else if let Some(v) = token.strip_prefix("product:") {
                product = v.to_owned();
            } else if let Some(v) = token.strip_prefix("device:") {
                device = v.to_owned();
            }
        }
        devices.push(AdbDevice {
            serial: serial.to_owned(),
            state: state.to_owned(),
            model,
            product,
            device,
        });
    }
    devices
}
