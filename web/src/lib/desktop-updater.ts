/**
 * Desktop updater — Tauri-only. In the browser build, every export here
 * is a safe no-op.
 *
 * Flow:
 *   1. On app start, `checkForUpdate()` runs once. If Tauri's plugin says
 *      an update is available, it returns descriptor info (version,
 *      release notes, download function).
 *   2. The React `<UpdateChecker />` component renders a non-blocking
 *      banner offering "Update now" / "Later".
 *   3. "Update now" downloads the bundle, applies it, and `relaunch()`s
 *      the app. Tauri handles the OS-specific install ceremony — DMG
 *      replace on macOS, MSI overwrite on Windows, AppImage rewrite on
 *      Linux.
 *
 * Signing: the bundle is verified against the public key embedded at
 * build time (configured in `src-tauri/tauri.conf.json` under
 * `plugins.updater.pubkey`). A bundle signed with anything else is
 * rejected before installation — that's the protection against a
 * compromised update endpoint serving malware.
 */

import { logError } from "./error-log";

export interface UpdateInfo {
  /** Semver of the new release. */
  version: string;
  /** Release notes (markdown). */
  body: string | null;
  /** Triggers download + install. Throws on failure. */
  downloadAndInstall: () => Promise<void>;
  /** Restart the app after install. */
  relaunch: () => Promise<void>;
}

/** True when running inside Tauri (vs a plain browser tab). */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 sets __TAURI_INTERNALS__; v1 set __TAURI__. We support v2.
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}

/**
 * Check for an update. Returns null when running in the browser (we don't
 * ship over-the-wire updates to the web tier — Vercel deploys handle that),
 * when no update is available, or when the check errored. Errors are logged
 * but not thrown — a flaky update endpoint shouldn't prevent the app from
 * starting.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;

  try {
    const updaterSpecifier: string = "@tauri-apps/plugin-updater";
    const processSpecifier: string = "@tauri-apps/plugin-process";
    const updater = (await import(/* @vite-ignore */ updaterSpecifier)) as {
      check: () => Promise<UpdaterCheckResult | null>;
    };
    const proc = (await import(/* @vite-ignore */ processSpecifier)) as {
      relaunch: () => Promise<void>;
    };

    const update = await updater.check();
    if (!update?.available) return null;

    return {
      version: update.version,
      body: update.body ?? null,
      downloadAndInstall: () => update.downloadAndInstall(),
      relaunch: () => proc.relaunch(),
    };
  } catch (err) {
    logError("desktop-updater.check", err);
    return null;
  }
}

/** Minimal shape we lean on from the plugin's return value. */
interface UpdaterCheckResult {
  available: boolean;
  version: string;
  body?: string;
  downloadAndInstall: () => Promise<void>;
}
