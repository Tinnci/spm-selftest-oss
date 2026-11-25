#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod desktop_update;

use spm_selftest::self_test;

fn main() {
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init());
    let builder = if context.config().plugins.0.contains_key("updater") {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    builder
        .invoke_handler(tauri::generate_handler![
            desktop_update::check_desktop_update,
            desktop_update::install_desktop_update,
            self_test::self_test_env,
            self_test::self_test_run,
            self_test::self_test_launcher_layout,
            self_test::self_test_list,
            self_test::self_test_get,
            self_test::self_test_update_meta,
            self_test::self_test_delete,
            self_test::self_test_diff,
            self_test::self_test_export_file,
            self_test::self_test_storage,
            self_test::self_test_rename,
            self_test::self_test_recheck,
            self_test::self_test_review_plan,
            self_test::self_test_review_save,
            self_test::self_test_review_status,
            self_test::self_test_adb_restart,
            self_test::self_test_wait_device,
        ])
        .run(context)
        .expect("SPM self-test runtime");
}
