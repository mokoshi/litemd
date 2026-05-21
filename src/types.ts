export type FileSignature = {
  modified_ms: number | null;
  len: number;
};

export type FileContent = {
  path: string;
  contents: string;
  signature: FileSignature;
};

export type GitDiffContext = {
  is_git: boolean;
  repo_root: string | null;
  relative_path: string | null;
  head_content: string | null;
  is_new_file: boolean;
  error: string | null;
};

export type CliInstallResult = {
  link_path: string;
  target_path: string;
};

export type WorkspaceView = "split" | "preview" | "diff";
export type SaveState = "saved" | "dirty" | "saving" | "error";
export type UpdateState = "idle" | "checking" | "available" | "installing" | "error";

export type EditorTab = {
  id: string;
  path: string;
  title: string;
  content: string;
  savedContent: string;
  fileSignature: FileSignature;
  view: WorkspaceView;
  gitContext: GitDiffContext | null;
  saveState: SaveState;
  status: string;
};

export type StoredSessionTab = {
  path: string;
  view: WorkspaceView;
};

export type StoredSession = {
  version: 2;
  tabs: StoredSessionTab[];
  activePath: string | null;
};
