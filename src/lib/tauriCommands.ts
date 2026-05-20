import { invoke } from "@tauri-apps/api/core";
import type {
  CliInstallResult,
  FileContent,
  FileSignature,
  GitDiffContext,
} from "../types";

export function readFile(path: string) {
  return invoke<FileContent>("read_file", { path });
}

export function writeFile(path: string, contents: string) {
  return invoke<FileSignature>("write_file", { path, contents });
}

export function fileSignature(path: string) {
  return invoke<FileSignature>("file_signature", { path });
}

export function initialCliFiles() {
  return invoke<string[]>("initial_cli_files");
}

export function installCliCommand() {
  return invoke<CliInstallResult>("install_cli_command");
}

export function getGitDiffContext(path: string) {
  return invoke<GitDiffContext>("get_git_diff_context", { path });
}
