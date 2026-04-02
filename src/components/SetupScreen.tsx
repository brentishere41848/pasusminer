import { Icon } from "./Icon";
import type { SetupStatus } from "../lib/types";

interface SetupScreenProps {
  setup: SetupStatus;
}

export function SetupScreen({ setup }: SetupScreenProps) {
  return (
    <main className="setup-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient-grid" />

      <section className="command-bar panel">
        <div className="command-brand">
          <div className="brand-icon">
            <Icon name="spark" />
          </div>
          <div>
            <p className="eyebrow">Pasus Miner</p>
            <h1>Setup deck missing miner binaries.</h1>
          </div>
        </div>
      </section>

      <section className="setup-hero panel">
        <div className="hero-copy-block">
          <p className="section-kicker">Initialization</p>
          <h2>The app shell is ready. External miner executables still need to be placed in the expected folders.</h2>
          <p className="setup-copy">
            Pasus Miner does not bundle third-party miners. Once the binaries are present, restart the app and the
            main dashboard will take over automatically.
          </p>
        </div>

        <div className="telemetry-strip setup-telemetry">
          <article className={`telemetry-card ${setup.gpu.exists ? "" : "warning"}`}>
            <div className="telemetry-icon">
              <Icon name="gpu" />
            </div>
            <div className="telemetry-copy">
              <span>GPU lane</span>
              <strong>{setup.gpu.exists ? "Detected" : "Missing"}</strong>
              <p>{setup.gpu.path}</p>
            </div>
          </article>

          <article className={`telemetry-card ${setup.cpu.exists ? "" : "warning"}`}>
            <div className="telemetry-icon">
              <Icon name="cpu" />
            </div>
            <div className="telemetry-copy">
              <span>CPU lane</span>
              <strong>{setup.cpu.exists ? "Detected" : "Missing"}</strong>
              <p>{setup.cpu.path}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="setup-grid">
        <section className="panel setup-card dashboard-setup-card">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Required Files</p>
              <h2>Executable placement</h2>
            </div>
            <span className="section-chip subtle">Windows desktop workflow</span>
          </div>

          <div className="operator-list">
            <article className={`operator-card tool-card ${setup.gpu.exists ? "ready" : "missing"}`}>
              <div className="operator-icon">
                <Icon name="gpu" />
              </div>
              <div>
                <strong>BzMiner for GPU mining</strong>
                <p>Used for KawPow-based GPU mining. For your current RVN preset, BzMiner is the preferred path.</p>
                <code>{setup.gpu.path}</code>
              </div>
            </article>

            <article className={`operator-card tool-card ${setup.cpu.exists ? "ready" : "missing"}`}>
              <div className="operator-icon">
                <Icon name="cpu" />
              </div>
              <div>
                <strong>XMRig for CPU mining</strong>
                <p>Used for RandomX CPU mining through the automatic `rx.unmineable.com` preset.</p>
                <code>{setup.cpu.path}</code>
              </div>
            </article>
          </div>
        </section>

        <section className="panel setup-card dashboard-setup-card">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Operator Checklist</p>
              <h2>What to place where</h2>
            </div>
            <span className="section-chip">No web app fallback</span>
          </div>

          <div className="setup-checklist">
            <article className="insight-card">
              <span className="insight-label">1. GPU folder</span>
              <strong>`tools/gpu/bzminer(.exe)` or `tools/gpu/t-rex(.exe)`</strong>
              <p>BzMiner is the primary GPU backend. T-Rex can sit there as a manual fallback, but RVN defaults to KawPow on BzMiner.</p>
            </article>
            <article className="insight-card">
              <span className="insight-label">2. CPU folder</span>
              <strong>`tools/cpu/xmrig(.exe)`</strong>
              <p>Optional, but required if you want CPU mining or CPU test mode enabled.</p>
            </article>
            <article className="insight-card">
              <span className="insight-label">3. Restart app</span>
              <strong>Re-open Pasus Miner</strong>
              <p>The dashboard will detect the binaries and unlock the normal command center automatically.</p>
            </article>
          </div>

          <div className="setup-terminal-preview">
            <div className="terminal-topbar">
              <div className="terminal-lights" aria-hidden="true">
                <span className="terminal-light red" />
                <span className="terminal-light amber" />
                <span className="terminal-light green" />
              </div>
              <div className="terminal-title">
                <Icon name="folder" className="terminal-title-icon" />
                <span>setup.instructions</span>
              </div>
            </div>
            <div className="setup-preview-body">
              <pre>{`tools/gpu/bzminer.exe   # primary GPU backend\ntools/gpu/t-rex.exe     # optional fallback\ntools/cpu/xmrig.exe\nrestart Pasus Miner`}</pre>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
