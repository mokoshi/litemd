use serde::Serialize;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
struct FileContent {
    path: String,
    contents: String,
    signature: FileSignature,
}

#[derive(Clone, Serialize)]
struct FileSignature {
    modified_ms: Option<u64>,
    len: u64,
}

#[derive(Serialize)]
struct GitDiffContext {
    is_git: bool,
    repo_root: Option<String>,
    relative_path: Option<String>,
    head_content: Option<String>,
    is_new_file: bool,
    error: Option<String>,
}

#[derive(Serialize)]
struct CliInstallResult {
    link_path: String,
    target_path: String,
}

#[tauri::command]
fn read_file(path: String) -> Result<FileContent, String> {
    let path = normalize_path(PathBuf::from(path))?;
    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {}: {}", path.display(), error))?;
    let signature = file_signature_for(&path)?;

    Ok(FileContent {
        path: path_to_string(&path)?,
        contents,
        signature,
    })
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<FileSignature, String> {
    let path = absolutize_path(PathBuf::from(path))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
    }

    fs::write(&path, contents)
        .map_err(|error| format!("Failed to write {}: {}", path.display(), error))?;

    file_signature_for(&path)
}

#[tauri::command]
fn file_signature(path: String) -> Result<FileSignature, String> {
    let path = normalize_path(PathBuf::from(path))?;
    file_signature_for(&path)
}

#[tauri::command]
fn initial_cli_files() -> Result<Vec<String>, String> {
    let cwd = std::env::current_dir()
        .map_err(|error| format!("Failed to get current directory: {}", error))?;
    Ok(cli_file_paths(std::env::args_os(), &cwd))
}

#[tauri::command]
fn install_cli_command() -> Result<CliInstallResult, String> {
    let target = bundled_cli_wrapper_path()?;
    let link = PathBuf::from("/usr/local/bin/litemd");

    install_symlink(&target, &link)?;

    Ok(CliInstallResult {
        link_path: path_to_string(&link)?,
        target_path: path_to_string(&target)?,
    })
}

#[tauri::command]
fn get_git_diff_context(path: String) -> Result<GitDiffContext, String> {
    let path = absolutize_path(PathBuf::from(path))?;
    let directory = path
        .parent()
        .ok_or_else(|| format!("Cannot resolve parent directory for {}", path.display()))?;

    let repo_root_output = match run_git(directory, &["rev-parse", "--show-toplevel"]) {
        Ok(output) => output,
        Err(_) => {
            return Ok(GitDiffContext {
                is_git: false,
                repo_root: None,
                relative_path: None,
                head_content: None,
                is_new_file: false,
                error: None,
            });
        }
    };

    let repo_root = PathBuf::from(repo_root_output.trim());
    let relative_path = path.strip_prefix(&repo_root).map_err(|_| {
        format!(
            "{} is not inside git repository {}",
            path.display(),
            repo_root.display()
        )
    })?;
    let relative_path_string = git_relative_path(relative_path)?;
    let object_name = format!("HEAD:{}", relative_path_string);

    match run_git(&repo_root, &["show", &object_name]) {
        Ok(head_content) => Ok(GitDiffContext {
            is_git: true,
            repo_root: Some(path_to_string(&repo_root)?),
            relative_path: Some(relative_path_string),
            head_content: Some(head_content),
            is_new_file: false,
            error: None,
        }),
        Err(error) => Ok(GitDiffContext {
            is_git: true,
            repo_root: Some(path_to_string(&repo_root)?),
            relative_path: Some(relative_path_string),
            head_content: Some(String::new()),
            is_new_file: true,
            error: Some(error),
        }),
    }
}

fn normalize_path(path: PathBuf) -> Result<PathBuf, String> {
    let path = absolutize_path(path)?;
    fs::canonicalize(&path)
        .map_err(|error| format!("Failed to resolve {}: {}", path.display(), error))
}

fn absolutize_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_absolute() {
        return Ok(path);
    }

    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to get current directory: {}", error))?;
    Ok(current_dir.join(path))
}

fn cli_file_paths<I>(args: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = OsString>,
{
    let mut values = args.into_iter().collect::<Vec<_>>();
    if values
        .first()
        .is_some_and(|value| looks_like_executable_arg(value))
    {
        values.remove(0);
    }

    let mut paths = Vec::new();
    let mut positional_only = false;

    for value in values {
        if value == OsStr::new("--") {
            positional_only = true;
            continue;
        }

        if !positional_only
            && value
                .to_str()
                .is_some_and(|text| text.starts_with('-'))
        {
            continue;
        }

        let path = PathBuf::from(value);
        let path = if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        };

        if let Ok(path) = path_to_string(&path) {
            paths.push(path);
        }
    }

    paths
}

fn looks_like_executable_arg(value: &OsStr) -> bool {
    let path = Path::new(value);
    path.file_name().is_some_and(|name| {
        name == OsStr::new("litemd") || name == OsStr::new("litemd.exe")
    })
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run git: {}", error))?;

    if output.status.success() {
        return String::from_utf8(output.stdout)
            .map_err(|error| format!("Git output was not valid UTF-8: {}", error));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!("git {} failed", args.join(" ")))
    } else {
        Err(stderr)
    }
}

fn file_signature_for(path: &Path) -> Result<FileSignature, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to read metadata for {}: {}", path.display(), error))?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(system_time_to_ms);

    Ok(FileSignature {
        modified_ms,
        len: metadata.len(),
    })
}

fn system_time_to_ms(time: SystemTime) -> Option<u64> {
    let millis = time.duration_since(SystemTime::UNIX_EPOCH).ok()?.as_millis();
    Some(millis.min(u128::from(u64::MAX)) as u64)
}

fn bundled_cli_wrapper_path() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve current executable: {}", error))?;
    let contents_dir = executable
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| format!("Cannot resolve app bundle from {}", executable.display()))?;
    let target = contents_dir.join("Resources").join("bin").join("litemd");

    if !target.exists() {
        return Err(format!(
            "CLI wrapper not found at {}. Install and run litemd from the .app bundle first.",
            target.display()
        ));
    }

    Ok(target)
}

#[cfg(unix)]
fn install_symlink(target: &Path, link: &Path) -> Result<(), String> {
    use std::os::unix::fs::symlink;

    if let Some(parent) = link.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {}", parent.display(), error))?;
    }

    match fs::symlink_metadata(link) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            let existing = fs::read_link(link)
                .map_err(|error| format!("Failed to read {}: {}", link.display(), error))?;
            if existing == target {
                return Ok(());
            }
            fs::remove_file(link)
                .map_err(|error| format!("Failed to remove {}: {}", link.display(), error))?;
        }
        Ok(_) => {
            return Err(format!(
                "{} already exists and is not a symlink. Remove it before installing the litemd command.",
                link.display()
            ));
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!("Failed to inspect {}: {}", link.display(), error));
        }
    }

    symlink(target, link).map_err(|error| {
        format!(
            "Failed to link {} -> {}: {}",
            link.display(),
            target.display(),
            error
        )
    })
}

#[cfg(not(unix))]
fn install_symlink(_target: &Path, _link: &Path) -> Result<(), String> {
    Err("Installing the litemd command is only supported on Unix-like systems for now.".to_string())
}

fn path_to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| format!("{} is not valid UTF-8", path.display()))
}

fn git_relative_path(path: &Path) -> Result<String, String> {
    let value = path_to_string(path)?;
    Ok(value.replace('\\', "/"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = cli_file_paths(args.into_iter().map(OsString::from), Path::new(&cwd));
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
            read_file,
            write_file,
            file_signature,
            initial_cli_files,
            install_cli_command,
            get_git_diff_context
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
