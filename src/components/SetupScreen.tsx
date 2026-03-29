import type { SetupStatus } from "../lib/types";

interface SetupScreenProps {
  setup: SetupStatus;
}

export function SetupScreen({ setup }: SetupScreenProps) {
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <p className="eyebrow">Setup Required</p>
        <h1>Pasus Miner</h1>
        <p className="setup-copy">
          This app does not bundle any miner. Place the external executables in the
          folders below, then restart the app.
        </p>

        <div className="setup-grid">
          <article className={`tool-card ${setup.gpu.exists ? "ready" : "missing"}`}>
            <h2>GPU Miner</h2>
            <p>BzMiner is required for KawPow GPU mining.</p>
            <code>{setup.gpu.path}</code>
            <strong>{setup.gpu.exists ? "Detected" : "Missing bzminer.exe"}</strong>
          </article>

          <article className={`tool-card ${setup.cpu.exists ? "ready" : "missing"}`}>
            <h2>CPU Miner</h2>
            <p>XMRig is optional and only needed for CPU mining.</p>
            <code>{setup.cpu.path}</code>
            <strong>{setup.cpu.exists ? "Detected" : "Missing xmrig.exe"}</strong>
          </article>
        </div>

        <div className="setup-note">
          <p>Expected folders</p>
          <ul>
            <li>
              <code>tools/gpu/bzminer.exe</code>
            </li>
            <li>
              <code>tools/cpu/xmrig.exe</code>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
