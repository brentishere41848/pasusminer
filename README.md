# Pasus Miner

Pasus Miner is a Tauri desktop application with a React + TypeScript frontend and a Rust backend.

It is not a browser-only website and not a plain SPA. The native Tauri shell owns process management, local file access, and packaging for desktop platforms.

## What It Does

- launches an external GPU miner for the Litecoin KawPow preset
- optionally launches an external CPU miner for Litecoin or Monero via RandomX
- streams live miner logs into the desktop UI
- keeps miner process lifecycle in the Tauri backend
- stores local config in the app config directory
- packages as a real desktop app for Windows and Linux

## Platform Support

The repository is configured to package on:

- Windows
- Linux

Packaging is native-per-platform. In practice that means:

- Windows artifacts are built on Windows runners
- Linux artifacts are built on Linux runners

This repo includes a GitHub Actions workflow that builds all three.

## Miner Binaries

Pasus Miner does not bundle miners. You must place the correct binary for the current platform in these folders:

- `tools/gpu/bzminer.exe` on Windows
- `tools/gpu/bzminer` on Linux
- `tools/cpu/xmrig.exe` on Windows
- `tools/cpu/xmrig` on Linux

The GPU miner is required for GPU mining. The CPU miner is optional.

When those binaries are present in the repository at build time, the desktop installers bundle the `tools/` directory into the packaged app automatically. The backend now checks the packaged Tauri resource directory first, so installed builds can launch bundled miners without asking the user to copy them manually.

## Local Development

Requirements by platform:

- Node.js 20+
- npm
- Rust toolchain
- Tauri native prerequisites for your platform

Additional native prerequisites:

- Windows: Microsoft Visual Studio C++ Build Tools
- Linux: WebKitGTK and the usual Tauri system libraries

Install and run:

1. Run `npm install`.
2. Place the correct miner binaries in `tools/gpu` and optionally `tools/cpu`.
3. Run `npm run tauri:dev`.

The app stores its config as `config.json` in the Tauri app config directory.

## Build Commands

Frontend build:

- `npm run build`

Desktop package build on the current OS:

- `npm run tauri:build`

Convenience aliases:

- `npm run tauri:build:windows`
- `npm run tauri:build:linux`

Tauri packages for the current platform under `src-tauri/target/release/bundle/`.

Typical outputs:

- Windows: `.exe` installer via NSIS
- Linux: `.AppImage`, `.deb`, and other supported Linux bundles

## GitHub Actions

The workflow at `.github/workflows/build-release.yml` builds artifacts on:

- `windows-latest`
- `ubuntu-22.04`

It uploads packaged artifacts for each platform so releases do not depend on one local machine.

The workflow at `.github/workflows/publish-release.yml` publishes a draft GitHub Release when you push a tag like `v0.1.0`. That release collects the native installers and bundles built on Windows and Linux runners.

## Runtime Notes

- Litecoin uses `bzminer` on `kp.unmineable.com:3333`
- Monero GPU payouts also use `bzminer` on `kp.unmineable.com:3333`
- Litecoin and Monero CPU presets use `xmrig` on `rx.unmineable.com:3333`
- payout strings are built as `{coin}:{wallet}.{worker}`
- duplicate backend starts are handled safely
- duplicate backend stops are ignored safely

## Safety Notes

- mining can consume substantial power
- mining can increase hardware temperature and long-term load
- the app requires warning acceptance before first start
- auto-start only affects app startup and does not create OS startup tasks

## Project Structure

```text
PasusMiner/
  .github/
    workflows/
      build-release.yml
  src/
    components/
    lib/
    App.tsx
    main.tsx
    styles.css
  src-tauri/
    src/
      commands.rs
      command_builder.rs
      config.rs
      log_parser.rs
      miner_manager.rs
      tools.rs
      main.rs
    Cargo.toml
    tauri.conf.json
  tools/
    gpu/
      bzminer(.exe)
    cpu/
      xmrig(.exe)
  config.sample.json
  README.md
```

## Desktop Verification

This project remains a real desktop application:

- [src-tauri/main.rs](C:/Users/Brent/PasusMiner/src-tauri/src/main.rs) is the native desktop entrypoint
- [src-tauri/tauri.conf.json](C:/Users/Brent/PasusMiner/src-tauri/tauri.conf.json) defines native bundling
- [src-tauri/src/miner_manager.rs](C:/Users/Brent/PasusMiner/src-tauri/src/miner_manager.rs) launches external miner processes
- [src-tauri/src/tools.rs](C:/Users/Brent/PasusMiner/src-tauri/src/tools.rs) resolves platform-specific miner binaries
- [src/App.tsx](C:/Users/Brent/PasusMiner/src/App.tsx) is only the embedded UI layer
