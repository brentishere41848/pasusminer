# Pasus Miner

Pasus Miner is a real Windows desktop application built with Tauri + React + TypeScript.

It is not a browser-only website, not a plain React SPA, and not a frontend-only mockup. The React UI is embedded inside a native Tauri desktop window, while the Rust backend handles local files, process management, executable detection, and stdout/stderr streaming.

Pasus Miner is a Windows desktop launcher for external miners. It does not implement mining itself. It provides:

- launching `bzminer.exe` for KawPow GPU mining
- optionally launching `xmrig.exe` for CPU mining
- streaming live logs to the UI
- showing miner status and parseable hashrate
- keeping miner process ownership in the Tauri backend instead of React component lifecycle
- showing the exact miner command line in the desktop UI for debugging
- saving settings locally in JSON

## Requirements

- Windows 10 or Windows 11
- Node.js 20+ and npm
- Rust toolchain installed for Tauri builds
- Microsoft Visual Studio C++ Build Tools

## Miner Executables

Place the external miner binaries in these folders:

- `tools/gpu/bzminer.exe`
- `tools/cpu/xmrig.exe`

The CPU miner is optional. The GPU miner is required for KawPow mining.

## Install Steps

1. Install Node.js and npm.
2. Install Rust from `https://rustup.rs/`.
3. Install the Visual Studio C++ build tools required by Tauri.
4. Open a terminal in the project root.
5. Run `npm install`.

## Development Mode

1. Ensure `bzminer.exe` is placed in `tools/gpu`.
2. Optionally place `xmrig.exe` in `tools/cpu`.
3. Run `npm run tauri:dev`.

The app stores its config in the Tauri app config directory as `config.json`.

## Build For Windows

1. Run `npm run build`.
2. Run `npm run tauri:build`.

Tauri will generate a packaged Windows desktop build under `src-tauri/target/release/bundle/`.

Expected Windows output includes an installer and packaged desktop application artifacts, typically under:

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/`

## Default GPU Pool

- Host: `kp.unmineable.com`
- Port: `3333`

GPU payout wallet strings are built like this:

- `ltc:{wallet}.{worker}`

Example:

- `ltc:LMYWalletAddress.worker-01`

## CPU Mining

CPU mining is optional and uses a separate config block and separate process. XMRig is only launched when the CPU toggle is enabled.

The CPU miner lifecycle is backend-owned:

- the frontend only sends explicit start and stop commands
- React mount or rerender does not start or stop XMRig
- duplicate starts return an already-running state instead of spawning another process
- duplicate stops are ignored safely
- IPv4 is forced by default with `--dns-ipv6=0`

## Safety Notes

- Mining can consume substantial power.
- Mining can increase heat and long-duration hardware load.
- The app requires the user to accept a warning before the first start.
- Auto-start mining is disabled by default. The optional setting only starts mining when the app itself launches. It does not create Windows startup tasks.

## Launch And Test

1. Place `bzminer.exe` into `tools/gpu`.
2. Optionally place `xmrig.exe` into `tools/cpu`.
3. Run `npm install`.
4. Run `npm run tauri:dev`.
5. In the app, enter a wallet address and worker name.
6. Leave the default GPU pool as `kp.unmineable.com:3333` unless you want a different KawPow pool.
7. Accept the resource usage warning checkbox.
8. Click `Start`.
9. Verify that the GPU log panel shows live BzMiner output.
10. If CPU mining is enabled and `xmrig.exe` exists, verify the CPU log panel also streams output.
11. Click `Stop` and confirm both processes terminate cleanly.

## Project Structure

```text
PasusMiner/
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
      bzminer.exe
    cpu/
      xmrig.exe
  config.sample.json
  README.md
```

## Desktop Verification

This project is structured as a Tauri desktop app:

- `src-tauri/main.rs` is the native Rust desktop entrypoint.
- `src-tauri/tauri.conf.json` defines the native desktop window and Windows bundling target.
- `src-tauri/src/miner_manager.rs` launches and manages external Windows executables.
- `src-tauri/src/config.rs` reads and writes local config files.
- `src/` contains only the embedded UI layer rendered inside the native desktop window.
