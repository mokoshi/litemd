use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::models::{FileContent, FileSignature};
use crate::paths::{absolutize_path, normalize_path, path_to_string};

#[tauri::command]
pub(crate) fn read_file(path: String) -> Result<FileContent, String> {
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
pub(crate) fn write_file(path: String, contents: String) -> Result<FileSignature, String> {
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
pub(crate) fn file_signature(path: String) -> Result<FileSignature, String> {
    let path = normalize_path(PathBuf::from(path))?;
    file_signature_for(&path)
}

pub(crate) fn file_signature_for(path: &Path) -> Result<FileSignature, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to read metadata for {}: {}", path.display(), error))?;
    let modified_ms = metadata.modified().ok().and_then(system_time_to_ms);

    Ok(FileSignature {
        modified_ms,
        len: metadata.len(),
    })
}

fn system_time_to_ms(time: SystemTime) -> Option<u64> {
    let millis = time
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()?
        .as_millis();
    Some(millis.min(u128::from(u64::MAX)) as u64)
}
