# Project rules

This repository must produce a real Windows desktop application.

Rules:
- Never build a browser-only website for this project.
- Never deliver a plain React SPA as the final product.
- Always use Tauri for the app shell unless explicitly told otherwise.
- The app must be packaged as a Windows desktop application.
- Use React + TypeScript only as the frontend inside Tauri.
- Backend logic must handle launching external miner executables.