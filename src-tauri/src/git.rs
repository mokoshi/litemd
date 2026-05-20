use std::path::PathBuf;
use std::process::Command;

use crate::models::GitDiffContext;
use crate::paths::{absolutize_path, git_relative_path, path_to_string};

#[tauri::command]
pub(crate) fn get_git_diff_context(path: String) -> Result<GitDiffContext, String> {
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

fn run_git(cwd: &std::path::Path, args: &[&str]) -> Result<String, String> {
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
