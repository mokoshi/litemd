import { useCallback } from "react";
import { installCliCommand as installCliCommandRequest } from "../lib/tauriCommands";

export function useCliInstaller() {
  return useCallback(async () => {
    try {
      const result = await installCliCommandRequest();
      window.alert(
        `Installed litemd command:\n${result.link_path} -> ${result.target_path}`,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  }, []);
}
