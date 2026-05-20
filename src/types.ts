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

export type ViewMode = "preview" | "diff";
export type ViewLayout = "split" | "previewOnly";
export type DiffLayout = "sideBySide" | "unified";
export type SaveState = "saved" | "dirty" | "saving" | "error";
export type UpdateState = "idle" | "checking" | "available" | "installing" | "error";

export type EditorTab = {
  id: string;
  path: string;
  title: string;
  content: string;
  savedContent: string;
  fileSignature: FileSignature;
  mode: ViewMode;
  layout: ViewLayout;
  diffLayout: DiffLayout;
  gitContext: GitDiffContext | null;
  saveState: SaveState;
  status: string;
};

export type StoredSessionTab = {
  path: string;
  mode: ViewMode;
  layout: ViewLayout;
  diffLayout: DiffLayout;
};

export type StoredSession = {
  version: 1;
  tabs: StoredSessionTab[];
  activePath: string | null;
};
