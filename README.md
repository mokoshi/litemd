# litemd

litemd は、Tauri、React、TypeScript で作る軽量なデスクトップ Markdown エディタです。

## 機能

- エディタとプレビューを並べた 2 ペイン表示
- 開いている Markdown ファイルを切り替えられるブラウザ風のタブ
- 編集内容の自動保存
- Markdown プレビューでの Mermaid チャート表示
- 現在開いているファイルの Git 差分表示
- 差分はエディタ上の内容と `HEAD` を比較
- Git 管理下の新規ファイルは、空ファイルからの差分として表示
- `litemd A.md` のような CLI 起動

## 開発

依存関係をインストールします。

```sh
pnpm install
```

開発用の Tauri アプリを起動します。

```sh
pnpm tauri:dev
```

フロントエンドをビルドします。

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

まず `litemd.app` を `/Applications` に移動して GUI アプリをインストールします。
その後、アプリを起動し、初期画面から CLI コマンドをインストールしてください。
次のシンボリックリンクが作成されます。

```sh
/usr/local/bin/litemd -> /Applications/litemd.app/Contents/Resources/bin/litemd
```

インストール後は、シェルから Markdown ファイルを開けます。

```sh
litemd A.md
litemd A.md B.md
```

すでにアプリが起動している場合、後続の CLI 実行は既存ウィンドウに転送され、
対象ファイルはタブとして開かれます。

## アップデート

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

リリースを公開するには、SemVer 形式のタグを push します。

```sh
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` は macOS の `aarch64` と `x86_64` 向けアプリをビルドし、
アップデータ用の署名と `latest.json` を GitHub Release にアップロードします。

現在の Tauri の推移的依存関係が Rust `1.88.0` 以上を要求するため、
このリポジトリでは `rust-toolchain.toml` で Rust `1.88.0` を固定しています。

## v1 メモ

- 差分表示は現在アクティブなタブだけを対象にします。
- staged/index との比較はまだ実装していません。
