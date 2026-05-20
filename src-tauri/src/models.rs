use serde::Serialize;

#[derive(Serialize)]
pub(crate) struct FileContent {
    pub(crate) path: String,
    pub(crate) contents: String,
    pub(crate) signature: FileSignature,
}

#[derive(Clone, Serialize)]
pub(crate) struct FileSignature {
    pub(crate) modified_ms: Option<u64>,
    pub(crate) len: u64,
}

#[derive(Serialize)]
pub(crate) struct GitDiffContext {
    pub(crate) is_git: bool,
    pub(crate) repo_root: Option<String>,
    pub(crate) relative_path: Option<String>,
    pub(crate) head_content: Option<String>,
    pub(crate) is_new_file: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct CliInstallResult {
    pub(crate) link_path: String,
    pub(crate) target_path: String,
}
