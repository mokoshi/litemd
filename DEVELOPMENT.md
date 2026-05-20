# 開発ガイド

このドキュメントは、litemd の開発、ビルド、リリースに必要な手順をまとめたものです。

## 必要なもの

- Node.js 22
- pnpm 9.7.0
- Rust 1.88.0
- Tauri の macOS ビルドに必要なローカル環境

Rust は `rust-toolchain.toml` で `1.88.0` に固定しています。
現在の Tauri の推移的依存関係が Rust `1.88.0` 以上を要求するためです。

## セットアップ

依存関係をインストールします。

```sh
pnpm install
```

開発用の Tauri アプリを起動します。

```sh
pnpm tauri:dev
```

## ビルド

フロントエンドだけをビルドします。

```sh
pnpm build
```

デスクトップアプリをビルドします。

```sh
pnpm tauri:build
```

ビルドすると、実行ファイルと macOS のアプリバンドルが生成されます。

```sh
src-tauri/target/release/litemd
src-tauri/target/release/bundle/macos/litemd.app
```

## CLI コマンド

`litemd.app` を `/Applications` に移動して GUI アプリをインストールします。
その後、アプリを起動し、初期画面から CLI コマンドをインストールしてください。
次のシンボリックリンクが作成されます。

```sh
/usr/local/bin/litemd -> /Applications/litemd.app/Contents/Resources/bin/litemd
```

## 自動アップデート

litemd は Tauri updater plugin を使い、GitHub Releases を静的なアップデート配信元として利用します。

```sh
https://github.com/mokoshi/litemd/releases/latest/download/latest.json
```

アップデータの公開鍵は `src-tauri/tauri.conf.json` に設定されています。
秘密署名鍵は `src-tauri/updater/litemd.key` に生成されますが、このファイルは意図的に Git 管理から除外しています。
リリースを公開する前に、秘密署名鍵の内容を GitHub Actions Secrets に登録してください。

```sh
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

現在生成している鍵にはパスワードを設定していないため、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` は空で構いません。

GitHub Actions 用の secret は次のコマンドで登録できます。

```sh
gh secret set TAURI_SIGNING_PRIVATE_KEY < src-tauri/updater/litemd.key
```

ローカルで署名付きビルドを作る場合は、秘密署名鍵を指定して実行します。

```sh
TAURI_SIGNING_PRIVATE_KEY="$(pwd)/src-tauri/updater/litemd.key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD= \
pnpm tauri:build
```

## リリース

リリースを公開するには、SemVer 形式のタグを push します。

```sh
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` は macOS の `aarch64` と `x86_64` 向けアプリをビルドし、
アップデータ用の署名と `latest.json` を GitHub Release にアップロードします。
