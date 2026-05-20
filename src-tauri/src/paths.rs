use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn normalize_path(path: PathBuf) -> Result<PathBuf, String> {
    let path = absolutize_path(path)?;
    fs::canonicalize(&path)
        .map_err(|error| format!("Failed to resolve {}: {}", path.display(), error))
}

pub(crate) fn absolutize_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_absolute() {
        return Ok(path);
    }

    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to get current directory: {}", error))?;
    Ok(current_dir.join(path))
}

pub(crate) fn path_to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| format!("{} is not valid UTF-8", path.display()))
}

pub(crate) fn git_relative_path(path: &Path) -> Result<String, String> {
    let value = path_to_string(path)?;
    Ok(value.replace('\\', "/"))
}
