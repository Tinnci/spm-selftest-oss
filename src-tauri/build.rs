fn emit_git_version() {
    println!("cargo:rerun-if-changed=../.git/HEAD");
    println!("cargo:rerun-if-changed=../.git/packed-refs");
    let run_git = |args: &[&str]| -> Option<String> {
        std::process::Command::new("git")
            .args(args)
            .output()
            .ok()
            .filter(|out| out.status.success())
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let sha = run_git(&["rev-parse", "--short=7", "HEAD"]).or_else(|| {
        std::env::var("GITHUB_SHA")
            .ok()
            .map(|s| s.chars().take(7).collect::<String>())
            .filter(|s| !s.is_empty())
    });
    let rev = run_git(&["rev-list", "--count", "HEAD"]);
    let pkg = std::env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.1.0".into());
    let display = match (&rev, &sha) {
        (Some(r), Some(s)) => format!("{pkg} (r{r} · {s})"),
        (None, Some(s)) => format!("{pkg} ({s})"),
        (Some(r), None) => format!("{pkg} (r{r})"),
        (None, None) => pkg,
    };
    println!(
        "cargo:rustc-env=SELFTEST_GIT_SHA={}",
        sha.unwrap_or_default()
    );
    println!(
        "cargo:rustc-env=SELFTEST_GIT_REV={}",
        rev.unwrap_or_default()
    );
    println!("cargo:rustc-env=SELFTEST_DISPLAY_VERSION={display}");
}

fn main() {
    emit_git_version();
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "check_desktop_update",
            "install_desktop_update",
            "self_test_env",
            "self_test_run",
            "self_test_launcher_layout",
            "self_test_list",
            "self_test_get",
            "self_test_update_meta",
            "self_test_delete",
            "self_test_diff",
            "self_test_export_file",
            "self_test_storage",
            "self_test_backup_export",
            "self_test_backup_import",
            "self_test_rename",
            "self_test_recheck",
            "self_test_review_plan",
            "self_test_review_save",
            "self_test_review_status",
            "self_test_adb_restart",
            "self_test_wait_device",
        ]),
    ))
    .expect("Tauri build configuration");
}
