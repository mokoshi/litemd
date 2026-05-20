import { useCallback, useEffect, useRef, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import type { UpdateState } from "../types";

export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateStatus, setUpdateStatus] = useState("Check for Updates");
  const updateStateRef = useRef(updateState);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  const setState = useCallback((state: UpdateState) => {
    updateStateRef.current = state;
    setUpdateState(state);
  }, []);

  const installUpdate = useCallback(
    async (update: Update) => {
      setState("installing");
      setUpdateStatus("Downloading update...");

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started" || event.event === "Progress") {
          setUpdateStatus("Downloading update...");
        }

        if (event.event === "Finished") {
          setUpdateStatus("Installing update...");
        }
      });

      setUpdateStatus("Restarting...");
      await relaunch();
    },
    [setState],
  );

  const checkForUpdates = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (
        updateStateRef.current === "checking" ||
        updateStateRef.current === "installing"
      ) {
        return;
      }

      setState("checking");
      setUpdateStatus("Checking...");

      try {
        const update = await check();
        if (!update?.available) {
          setState("idle");
          setUpdateStatus("Up to date");
          if (!options.silent) {
            window.alert("litemd is up to date.");
          }
          return;
        }

        setState("available");
        setUpdateStatus(`Update ${update.version} available`);
        const shouldInstall = window.confirm(
          `litemd ${update.version} is available.\nInstall it now and restart?`,
        );

        if (shouldInstall) {
          await installUpdate(update);
        }
      } catch (error) {
        setState("error");
        setUpdateStatus("Update check failed");
        if (!options.silent) {
          window.alert(error instanceof Error ? error.message : String(error));
        }
      }
    },
    [installUpdate, setState],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkForUpdates({ silent: true });
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [checkForUpdates]);

  return {
    checkForUpdates,
    updateState,
    updateStatus,
  };
}
