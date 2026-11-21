fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "check_desktop_update",
            "install_desktop_update",
            "self_test_env",
            "self_test_run",
            "self_test_list",
            "self_test_get",
            "self_test_update_meta",
            "self_test_delete",
            "self_test_diff",
            "self_test_export_file",
            "self_test_storage",
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
