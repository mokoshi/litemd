mod cli;
mod files;
mod git;
mod models;
mod paths;

use std::ffi::OsString;
use std::path::Path;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = cli::cli_file_paths(args.into_iter().map(OsString::from), Path::new(&cwd));
            if !paths.is_empty() {
                let _ = app.emit("open-cli-files", paths);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            files::read_file,
            files::write_file,
            files::file_signature,
            cli::initial_cli_files,
            cli::install_cli_command,
            git::get_git_diff_context
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
