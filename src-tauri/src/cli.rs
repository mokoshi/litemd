use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use crate::models::CliInstallResult;
use crate::paths::path_to_string;

#[tauri::command]
pub(crate) fn initial_cli_files() -> Result<Vec<String>, String> {
    let cwd = std::env::current_dir()
        .map_err(|error| format!("Failed to get current directory: {}", error))?;
    Ok(cli_file_paths(std::env::args_os(), &cwd))
}

#[tauri::command]
pub(crate) fn install_cli_command() -> Result<CliInstallResult, String> {
    let target = bundled_cli_wrapper_path()?;
    let link = PathBuf::from("/usr/local/bin/litemd");

    install_symlink(&target, &link)?;

    Ok(CliInstallResult {
        link_path: path_to_string(&link)?,
        target_path: path_to_string(&target)?,
    })
}

pub(crate) fn cli_file_paths<I>(args: I, cwd: &Path) -> Vec<String>
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

        if !positional_only && value.to_str().is_some_and(|text| text.starts_with('-')) {
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
    path.file_name()
        .is_some_and(|name| name == OsStr::new("litemd") || name == OsStr::new("litemd.exe"))
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

#[cfg(test)]
mod tests {
    use super::*;

    fn os_args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn cli_file_paths_skips_executable_and_options() {
        let paths = cli_file_paths(
            os_args(&["litemd", "--verbose", "a.md", "--", "-literal.md"]),
            Path::new("/work"),
        );

        assert_eq!(paths, vec!["/work/a.md", "/work/-literal.md"]);
    }

    #[test]
    fn cli_file_paths_keeps_absolute_paths() {
        let paths = cli_file_paths(os_args(&["/tmp/a.md"]), Path::new("/work"));

        assert_eq!(paths, vec!["/tmp/a.md"]);
    }
}
