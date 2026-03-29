import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LogPanel } from "./components/LogPanel";
import { SetupScreen } from "./components/SetupScreen";
import { StatusBadge } from "./components/StatusBadge";
import {
  getCpuMinerStatus,
  getGpuMinerStatus,
  loadRuntimeState,
  saveConfig,
  startCpuMiner,
  startCpuMinerTest,
  startGpuMiner,
  stopCpuMiner,
  stopGpuMiner
} from "./lib/api";
import { defaultConfig, emptyRuntimeState } from "./lib/defaults";
import { parseHashrate } from "./lib/logParser";
import type {
  AppConfig,
  HashrateEvent,
  MinerEventPayload,
  MinerSnapshot,
  MinerStatus,
  MinerStatusEvent,
  RuntimeState
} from "./lib/types";

function App() {
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(emptyRuntimeState);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [gpuLogs, setGpuLogs] = useState<string[]>([]);
  const [cpuLogs, setCpuLogs] = useState<string[]>([]);
  const [gpuStatus, setGpuStatus] = useState<MinerStatus>("stopped");
  const [cpuStatus, setCpuStatus] = useState<MinerStatus>("stopped");
  const [gpuHashrate, setGpuHashrate] = useState<string>("--");
  const [cpuHashrate, setCpuHashrate] = useState<string>("--");
  const [gpuCommandLine, setGpuCommandLine] = useState<string>("");
  const [cpuCommandLine, setCpuCommandLine] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const initialized = useRef(false);

  const toolsReady = runtimeState.setup.gpu.exists;

  useEffect(() => {
    let mounted = true;
    const unlisteners: UnlistenFn[] = [];

    async function initialize() {
      const state = await loadRuntimeState();
      if (!mounted) {
        return;
      }

      setRuntimeState(state);
      setConfig(state.config);
      setGpuStatus(state.gpuStatus.status);
      setCpuStatus(state.cpuStatus.status);
      setGpuCommandLine(state.gpuStatus.commandLine ?? "");
      setCpuCommandLine(state.cpuStatus.commandLine ?? "");
      initialized.current = true;
    }

    async function bindEvents() {
      const logUnlisten = await listen<MinerEventPayload>("miner-log", (event) => {
        const entry = `[${event.payload.miner.toUpperCase()}] ${event.payload.line}`;
        if (event.payload.miner === "gpu") {
          setGpuLogs((current) => [...current.slice(-499), entry]);
          const parsed = parseHashrate(event.payload.line);
          if (parsed) {
            setGpuHashrate(parsed);
          }
        } else {
          setCpuLogs((current) => [...current.slice(-499), entry]);
          const parsed = parseHashrate(event.payload.line);
          if (parsed) {
            setCpuHashrate(parsed);
          }
        }
      });

      const statusUnlisten = await listen<MinerStatusEvent>("miner-status", (event) => {
        if (event.payload.miner === "gpu") {
          setGpuStatus(event.payload.status);
          setGpuCommandLine(event.payload.commandLine ?? "");
        } else {
          setCpuStatus(event.payload.status);
          setCpuCommandLine(event.payload.commandLine ?? "");
        }

        if (event.payload.message) {
          setErrorMessage(event.payload.message);
        }
      });

      const hashrateUnlisten = await listen<HashrateEvent>("miner-hashrate", (event) => {
        if (event.payload.miner === "gpu") {
          setGpuHashrate(event.payload.hashrate);
        } else {
          setCpuHashrate(event.payload.hashrate);
        }
      });

      unlisteners.push(logUnlisten, statusUnlisten, hashrateUnlisten);
    }

    void initialize();
    void bindEvents();

    return () => {
      mounted = false;
      unlisteners.forEach((unlisten) => void unlisten());
    };
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      return;
    }

    void saveConfig(config);
  }, [config]);

  const payoutPreview = useMemo(() => {
    const wallet = config.wallet.trim();
    const worker = config.worker.trim() || "worker";
    if (!wallet) {
      return "ltc:your_wallet.worker";
    }

    return `ltc:${wallet}.${worker}`;
  }, [config.wallet, config.worker]);

  function updateField<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateNestedField<
    T extends "gpuPool" | "cpuPool",
    K extends keyof AppConfig[T]
  >(group: T, key: K, value: AppConfig[T][K]) {
    setConfig((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value
      }
    }));
  }

  async function refreshBackendStatus() {
    const [gpuSnapshot, cpuSnapshot] = await Promise.all([
      getGpuMinerStatus(),
      getCpuMinerStatus()
    ]);
    applySnapshot(gpuSnapshot);
    applySnapshot(cpuSnapshot);
  }

  function applySnapshot(snapshot: MinerSnapshot) {
    if (snapshot.miner === "gpu") {
      setGpuStatus(snapshot.status);
      setGpuCommandLine(snapshot.commandLine ?? "");
    } else {
      setCpuStatus(snapshot.status);
      setCpuCommandLine(snapshot.commandLine ?? "");
    }
  }

  async function handleStart() {
    const wallet = config.wallet.trim();
    const worker = config.worker.trim();

    if (!wallet) {
      setErrorMessage("Wallet address is required.");
      return;
    }

    if (!config.acceptedRiskWarning) {
      setErrorMessage("You must accept the resource usage warning before starting.");
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const normalizedConfig: AppConfig = {
        ...config,
        wallet,
        worker: worker || "worker",
        payoutTicker: config.payoutTicker.trim().toUpperCase()
      };

      setConfig(normalizedConfig);

      if (normalizedConfig.gpuEnabled) {
        setGpuLogs([]);
        setGpuHashrate("--");
        await startGpuMiner(normalizedConfig);
      } else {
        await stopGpuMiner();
      }

      if (normalizedConfig.cpuEnabled) {
        setCpuLogs([]);
        setCpuHashrate("--");
        await startCpuMiner(normalizedConfig);
      } else {
        await stopCpuMiner();
      }

      await refreshBackendStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start miners.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await Promise.all([stopGpuMiner(), stopCpuMiner()]);
      await refreshBackendStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to stop miners.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCpuTest() {
    const wallet = config.wallet.trim();
    if (!wallet) {
      setErrorMessage("Wallet address is required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setCpuLogs([]);
    setCpuHashrate("--");

    try {
      const normalizedConfig: AppConfig = {
        ...config,
        wallet,
        worker: config.worker.trim() || "worker",
        payoutTicker: config.payoutTicker.trim().toUpperCase()
      };
      setConfig(normalizedConfig);
      await startCpuMinerTest(normalizedConfig);
      await refreshBackendStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start CPU miner test.");
    } finally {
      setBusy(false);
    }
  }

  if (!toolsReady) {
    return <SetupScreen setup={runtimeState.setup} />;
  }

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div>
          <p className="eyebrow">Pasus Miner</p>
          <h1>Simple KawPow mining launcher for Windows</h1>
          <p className="hero-copy">
            Native Tauri desktop app. Backend process ownership stays in Rust and only the
            UI sends explicit start or stop commands.
          </p>
        </div>
        <div className="warning-card">
          <h2>Resource Warning</h2>
          <p>
            Mining can draw significant power, increase heat output, and stress CPU or
            GPU hardware for extended periods.
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={config.acceptedRiskWarning}
              onChange={(event) => updateField("acceptedRiskWarning", event.target.checked)}
            />
            <span>I understand and accept the hardware and power usage risk.</span>
          </label>
        </div>
      </section>

      <section className="content-grid">
        <section className="panel controls-panel">
          <div className="panel-header">
            <h2>Mining Controls</h2>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Wallet Address</span>
              <input
                type="text"
                value={config.wallet}
                onChange={(event) => updateField("wallet", event.target.value)}
                placeholder="Enter payout wallet"
              />
            </label>

            <label className="field">
              <span>Worker Name</span>
              <input
                type="text"
                value={config.worker}
                onChange={(event) => updateField("worker", event.target.value)}
                placeholder="worker-01"
              />
            </label>

            <label className="field">
              <span>Optional Coin Ticker</span>
              <input
                type="text"
                value={config.payoutTicker}
                onChange={(event) => updateField("payoutTicker", event.target.value.toUpperCase())}
                placeholder="LTC"
              />
            </label>

            <div className="field preview-field">
              <span>Wallet String Preview</span>
              <code>{payoutPreview}</code>
            </div>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.gpuEnabled}
                onChange={(event) => updateField("gpuEnabled", event.target.checked)}
              />
              <div>
                <strong>Enable GPU Mining</strong>
                <small>Uses BzMiner with KawPow.</small>
              </div>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.cpuEnabled}
                onChange={(event) => updateField("cpuEnabled", event.target.checked)}
                disabled={!runtimeState.setup.cpu.exists}
              />
              <div>
                <strong>Enable CPU Mining</strong>
                <small>Uses XMRig with backend-owned process lifecycle.</small>
              </div>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.autoStartOnLaunch}
                onChange={(event) => updateField("autoStartOnLaunch", event.target.checked)}
              />
              <div>
                <strong>Auto-start setting</strong>
                <small>Saved locally only. The UI does not auto-start miners on mount.</small>
              </div>
            </label>
          </div>

          <div className="button-row">
            <button className="primary-button" disabled={busy} onClick={() => void handleStart()}>
              Start
            </button>
            <button className="secondary-button" disabled={busy} onClick={() => void handleStop()}>
              Stop
            </button>
            <button className="secondary-button" disabled={busy} onClick={() => void handleCpuTest()}>
              CPU Test
            </button>
          </div>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>

        <section className="panel settings-panel">
          <div className="panel-header">
            <h2>Pool Settings</h2>
          </div>

          <div className="settings-group">
            <h3>GPU Pool</h3>
            <label className="field">
              <span>Host</span>
              <input
                type="text"
                value={config.gpuPool.host}
                onChange={(event) => updateNestedField("gpuPool", "host", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={config.gpuPool.port}
                onChange={(event) =>
                  updateNestedField("gpuPool", "port", Number(event.target.value))
                }
              />
            </label>
          </div>

          <div className="settings-group">
            <h3>CPU Pool</h3>
            <label className="field">
              <span>Host</span>
              <input
                type="text"
                value={config.cpuPool.host}
                onChange={(event) => updateNestedField("cpuPool", "host", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={config.cpuPool.port}
                onChange={(event) =>
                  updateNestedField("cpuPool", "port", Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>User / Wallet</span>
              <input
                type="text"
                value={config.cpuPool.user}
                onChange={(event) => updateNestedField("cpuPool", "user", event.target.value)}
                placeholder="Optional XMRig pool user"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="text"
                value={config.cpuPool.password}
                onChange={(event) =>
                  updateNestedField("cpuPool", "password", event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Algorithm</span>
              <input
                type="text"
                value={config.cpuPool.algo}
                onChange={(event) => updateNestedField("cpuPool", "algo", event.target.value)}
              />
            </label>
          </div>
        </section>
      </section>

      <section className="status-grid">
        <section className="panel stat-panel">
          <div className="panel-header">
            <h2>GPU Miner</h2>
          </div>
          <StatusBadge label="GPU Status" status={gpuStatus} />
          <div className="hashrate-card">
            <span>Hashrate</span>
            <strong>{gpuHashrate}</strong>
          </div>
          <div className="debug-panel">
            <span>Exact Command</span>
            <code>{gpuCommandLine || "No GPU command yet."}</code>
          </div>
        </section>

        <section className="panel stat-panel">
          <div className="panel-header">
            <h2>CPU Miner</h2>
          </div>
          <StatusBadge label="CPU Status" status={cpuStatus} />
          <div className="hashrate-card">
            <span>Hashrate</span>
            <strong>{cpuHashrate}</strong>
          </div>
          <div className="debug-panel">
            <span>Exact Command</span>
            <code>{cpuCommandLine || "No CPU command yet."}</code>
          </div>
        </section>
      </section>

      <section className="logs-grid">
        <LogPanel
          title="GPU Log"
          lines={gpuLogs}
          emptyMessage="GPU miner output will appear here."
        />
        <LogPanel
          title="CPU Log"
          lines={cpuLogs}
          emptyMessage="CPU miner output will appear here."
        />
      </section>
    </main>
  );
}

export default App;
