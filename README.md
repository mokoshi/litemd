# litemd

A lightweight desktop Markdown editor built with Tauri, React, and TypeScript.

## Features

- Two-pane Markdown editor and live preview
- Browser-style tabs for switching between open Markdown files
- Auto-save for edited files
- Mermaid chart rendering in Markdown preview
- Git-aware diff view for the currently opened file
- Diff compares the editor contents against `HEAD`
- New files inside a git repository are shown as a diff from an empty file
- CLI launch support, for example `litemd A.md`

## Development

Install dependencies:

```sh
pnpm install
```

Run the Tauri app in development:

```sh
pnpm tauri:dev
```

Build the frontend:

```sh
pnpm build
```

Build the desktop binary:

```sh
pnpm tauri:build
```

This produces both the release executable and the macOS app bundle:

```sh
src-tauri/target/release/litemd
src-tauri/target/release/bundle/macos/litemd.app
```

## CLI Command

Install the GUI app first by moving `litemd.app` to `/Applications`, then launch
the app and use `Install CLI Command` from the empty state. It creates:

```sh
/usr/local/bin/litemd -> /Applications/litemd.app/Contents/Resources/bin/litemd
```

After that, files can be opened from a shell:

```sh
litemd A.md
litemd A.md B.md
```

When the app is already running, later CLI invocations are forwarded to the
existing window and opened as tabs.

## Updates

litemd uses the Tauri updater plugin with GitHub Releases as the static update
backend:

```sh
https://github.com/mokoshi/litemd/releases/latest/download/latest.json
```

The updater public key is configured in `src-tauri/tauri.conf.json`. The private
signing key was generated at `src-tauri/updater/litemd.key` and is intentionally
gitignored. Store its contents in GitHub Actions Secrets before publishing:

```sh
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The generated key currently has no password, so
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` may be empty.

For GitHub Actions:

```sh
gh secret set TAURI_SIGNING_PRIVATE_KEY < src-tauri/updater/litemd.key
```

For local signed builds:

```sh
TAURI_SIGNING_PRIVATE_KEY="$(pwd)/src-tauri/updater/litemd.key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD= \
pnpm tauri:build
```

To publish a release, push a SemVer tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` builds macOS `aarch64` and `x86_64` artifacts,
uploads updater signatures, and uploads `latest.json` to the GitHub Release.

The repo pins Rust `1.88.0` in `rust-toolchain.toml` because current Tauri
transitive dependencies require at least that toolchain.

## v1 Notes

- Diff is intentionally scoped to the active tab only.
- Staged/index comparisons are not implemented yet.
