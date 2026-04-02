import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Icon } from "./components/Icon";
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
import { applyCoinPreset, buildPayoutUser, COIN_LABELS, sanitizeCoin } from "./lib/coins";
import { defaultConfig, emptyRuntimeState } from "./lib/defaults";
import { parseHashrateReading } from "./lib/logParser";
import type {
  AppConfig,
  HashrateEvent,
  MinerEventPayload,
  MinerSnapshot,
  MinerStatus,
  MinerStatusEvent,
  RuntimeState,
  SupportedCoin
} from "./lib/types";

type DashboardTab = "overview" | "control" | "logs";
type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "installed" | "error";

function App() {
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(emptyRuntimeState);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [gpuLogs, setGpuLogs] = useState<string[]>([]);
  const [cpuLogs, setCpuLogs] = useState<string[]>([]);
  const [gpuStatus, setGpuStatus] = useState<MinerStatus>("stopped");
  const [cpuStatus, setCpuStatus] = useState<MinerStatus>("stopped");
  const [gpuHashrate, setGpuHashrate] = useState<string>("--");
  const [cpuHashrate, setCpuHashrate] = useState<string>("--");
  const [gpuHistory, setGpuHistory] = useState<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [gpuCommandLine, setGpuCommandLine] = useState<string>("");
  const [cpuCommandLine, setCpuCommandLine] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateTotalBytes, setUpdateTotalBytes] = useState<number>(0);
  const [updateDownloadedBytes, setUpdateDownloadedBytes] = useState<number>(0);
  const [updateMessage, setUpdateMessage] = useState<string>("");
  const initialized = useRef(false);
  const pendingUpdateRef = useRef<Update | null>(null);

  const toolsReady = runtimeState.setup.gpu.exists;
  const selectedCoin = sanitizeCoin(config.payoutTicker);
  const payoutPreview = useMemo(
    () => buildPayoutUser(selectedCoin, config.wallet, config.worker),
    [config.wallet, config.worker, selectedCoin]
  );
  const cpuUserPreview = useMemo(
    () => buildPayoutUser(selectedCoin, config.wallet, config.worker),
    [config.wallet, config.worker, selectedCoin]
  );
  const activeMiners = [gpuStatus, cpuStatus].filter((status) => status === "running").length;
  const totalLogLines = gpuLogs.length + cpuLogs.length;
  const poolFingerprint = `${config.gpuPool.host}:${config.gpuPool.port} / ${config.cpuPool.host}:${config.cpuPool.port}`;
  const activeGpuBackend = "BzMiner";
  const gpuMaxHistory = Math.max(...gpuHistory, 1);
  const cpuMaxHistory = Math.max(...cpuHistory, 1);
  const updateProgressLabel =
    updateTotalBytes > 0
      ? `${Math.round(updateProgress)}% · ${Math.round(updateDownloadedBytes / 1024 / 1024)} / ${Math.round(updateTotalBytes / 1024 / 1024)} MB`
      : updatePhase === "downloading"
        ? "Downloading update..."
        : updatePhase === "installing"
          ? "Installing update..."
          : updateMessage;

  const telemetryCards = [
    {
      key: "wallet",
      icon: "wallet" as const,
      label: "Payout identity",
      value: COIN_LABELS[selectedCoin],
      detail: payoutPreview,
      tone: "accent"
    },
    {
      key: "miners",
      icon: "pulse" as const,
      label: "Live miners",
      value: `${activeMiners}/2`,
      detail: activeMiners > 0 ? "Compute lanes active" : "Idle and waiting",
      tone: ""
    },
    {
      key: "routing",
      icon: "route" as const,
      label: "Routing preset",
      value: "Auto-hosted",
      detail: poolFingerprint,
      tone: ""
    },
    {
      key: "safety",
      icon: "shield" as const,
      label: "Safety gate",
      value: config.acceptedRiskWarning ? "Acknowledged" : "Blocked",
      detail: "Launch requires explicit hardware risk consent.",
      tone: "warning"
    }
  ];

  useEffect(() => {
    let mounted = true;
    const unlisteners: UnlistenFn[] = [];

    async function initialize() {
      const state = await loadRuntimeState();
      if (!mounted) {
        return;
      }

      const normalizedConfig = applyCoinPreset(state.config, state.config.payoutTicker);
      setRuntimeState(state);
      setConfig(normalizedConfig);
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
          const parsed = parseHashrateReading(event.payload.line);
          if (parsed) {
            setGpuHashrate(parsed.text);
            setGpuHistory((current) => [...current.slice(-23), parsed.normalizedValue]);
          }
        } else {
          setCpuLogs((current) => [...current.slice(-499), entry]);
          const parsed = parseHashrateReading(event.payload.line);
          if (parsed) {
            setCpuHashrate(parsed.text);
            setCpuHistory((current) => [...current.slice(-23), parsed.normalizedValue]);
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
          const parsed = parseHashrateReading(event.payload.hashrate);
          if (parsed) {
            setGpuHistory((current) => [...current.slice(-23), parsed.normalizedValue]);
          }
        } else {
          setCpuHashrate(event.payload.hashrate);
          const parsed = parseHashrateReading(event.payload.hashrate);
          if (parsed) {
            setCpuHistory((current) => [...current.slice(-23), parsed.normalizedValue]);
          }
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
    let cancelled = false;

    async function checkForUpdates() {
      setUpdatePhase("checking");

      try {
        const update = await check();
        if (cancelled) {
          await update?.close().catch(() => undefined);
          return;
        }

        pendingUpdateRef.current = update;
        if (update) {
          setUpdateVersion(update.version);
          setUpdateNotes(update.body ?? "");
          setUpdateMessage(`Update ${update.version} is ready.`);
          setUpdatePhase("available");
        } else {
          setUpdateMessage("Pasus Miner is current.");
          setUpdatePhase("idle");
        }
      } catch {
        setUpdatePhase("idle");
      }
    }

    void checkForUpdates();

    return () => {
      cancelled = true;
      const update = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      if (update) {
        void update.close().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      return;
    }

    void saveConfig(config);
  }, [config]);

  function updateField<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
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

  function handleCoinChange(coin: SupportedCoin) {
    setConfig((current) => applyCoinPreset(current, coin));
    setErrorMessage("");
  }

  async function copyText(value: string, label: string) {
    if (!value.trim()) {
      setErrorMessage(`No ${label.toLowerCase()} available yet.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setErrorMessage(`${label} copied to clipboard.`);
    } catch {
      setErrorMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  async function handleStart() {
    const normalizedPreset = applyCoinPreset(config, selectedCoin);
    const wallet = normalizedPreset.wallet.trim();
    const worker = normalizedPreset.worker.trim();

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
        ...normalizedPreset,
        wallet,
        worker: worker || "worker",
        payoutTicker: selectedCoin
      };

      setConfig(normalizedConfig);

      if (normalizedConfig.gpuEnabled) {
        setGpuLogs([]);
        setGpuHashrate("--");
        setGpuHistory([]);
        await startGpuMiner(normalizedConfig);
      } else {
        await stopGpuMiner();
      }

      if (normalizedConfig.cpuEnabled) {
        setCpuLogs([]);
        setCpuHashrate("--");
        setCpuHistory([]);
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
    const normalizedPreset = applyCoinPreset(config, selectedCoin);
    const wallet = normalizedPreset.wallet.trim();
    if (!wallet) {
      setErrorMessage("Wallet address is required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setCpuLogs([]);
    setCpuHashrate("--");
    setCpuHistory([]);

    try {
      const normalizedConfig: AppConfig = {
        ...normalizedPreset,
        wallet,
        worker: normalizedPreset.worker.trim() || "worker",
        payoutTicker: selectedCoin
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

  async function handleInstallUpdate() {
    const update = pendingUpdateRef.current;
    if (!update) {
      setUpdateMessage("No update package is available right now.");
      setUpdatePhase("error");
      return;
    }

    setUpdatePhase("downloading");
    setUpdateDownloadedBytes(0);
    setUpdateTotalBytes(0);
    setUpdateProgress(0);
    setUpdateMessage(`Downloading ${update.version}...`);

    try {
      let contentLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            downloaded = 0;
            setUpdateTotalBytes(contentLength);
            setUpdateDownloadedBytes(0);
            setUpdateProgress(0);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setUpdateDownloadedBytes(downloaded);
            if (contentLength > 0) {
              setUpdateProgress((downloaded / contentLength) * 100);
            }
            break;
          case "Finished":
            setUpdatePhase("installing");
            setUpdateProgress(100);
            setUpdateMessage("Download finished. Starting installer...");
            break;
        }
      });

      setUpdatePhase("installed");
      setUpdateMessage("Update installed. Windows will close the app to complete the upgrade.");
      pendingUpdateRef.current = null;
    } catch (error) {
      setUpdatePhase("error");
      setUpdateMessage(error instanceof Error ? error.message : "Failed to install the update.");
    }
  }

  if (!toolsReady) {
    return <SetupScreen setup={runtimeState.setup} />;
  }

  return (
    <main className="app-shell">
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
            <h1>Operator-grade mining desk for Windows.</h1>
          </div>
        </div>

        <div className="command-actions">
          {updatePhase === "available" ? (
            <button className="update-ready-button" onClick={() => void handleInstallUpdate()}>
              <Icon name="spark" className="button-icon" />
              Update {updateVersion} Ready
            </button>
          ) : null}
          <button className="primary-button" disabled={busy} onClick={() => void handleStart()}>
            <Icon name="play" className="button-icon" />
            {busy ? "Working..." : "Launch Mining"}
          </button>
          <button className="secondary-button" disabled={busy} onClick={() => void handleStop()}>
            Stop Everything
          </button>
        </div>
      </section>

      {updatePhase !== "idle" ? (
        <section className={`update-banner panel ${updatePhase}`}>
          <div className="update-banner-copy">
            <p className="section-kicker">Updater</p>
            <h2>
              {updatePhase === "available"
                ? `Pasus Miner ${updateVersion} is available`
                : updatePhase === "downloading"
                  ? "Downloading update"
                  : updatePhase === "installing"
                    ? "Installing update"
                    : updatePhase === "installed"
                      ? "Update installed"
                      : updatePhase === "error"
                        ? "Update failed"
                        : "Checking for updates"}
            </h2>
            <p className="hero-copy">
              {updatePhase === "available" && updateNotes.trim()
                ? updateNotes
                : updateProgressLabel || updateMessage}
            </p>
            {updatePhase === "downloading" || updatePhase === "installing" ? (
              <div className="update-progress-track" aria-hidden="true">
                <span className="update-progress-fill" style={{ width: `${Math.max(updateProgress, 8)}%` }} />
              </div>
            ) : null}
          </div>

          <div className="update-banner-actions">
            {updatePhase === "available" ? (
              <button className="primary-button" onClick={() => void handleInstallUpdate()}>
                Install Update
              </button>
            ) : null}
            <span className="section-chip subtle">
              {updatePhase === "available" ? "Auto-check enabled on launch" : updateProgressLabel}
            </span>
          </div>
        </section>
      ) : null}

      <section className="hero-panel panel">
        <div className="hero-copy-block">
          <p className="section-kicker">Mission Brief</p>
          <h2>Native Tauri shell, automatic pool presets, and miner process ownership in Rust.</h2>
          <p className="hero-copy">
            The UI is now organized like a desktop console: top-level navigation, a live telemetry strip,
            a focused control deck, and terminal-grade miner output instead of a generic settings page.
          </p>
        </div>

        <div className="hero-side">
          <div className="hero-stack">
            <div className="hero-chip">
              <Icon name="wallet" className="hero-chip-icon" />
              <span>{COIN_LABELS[selectedCoin]} payout active</span>
            </div>
            <div className="hero-chip">
              <Icon name="route" className="hero-chip-icon" />
              <span>{poolFingerprint}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="telemetry-strip">
        {telemetryCards.map((card) => (
          <article key={card.key} className={`telemetry-card ${card.tone}`}>
            <div className="telemetry-icon">
              <Icon name={card.icon} />
            </div>
            <div className="telemetry-copy">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="tabs-shell panel">
        <div className="tabs-header">
          <div className="tab-rail" role="tablist" aria-label="Dashboard tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <Icon name="pulse" className="tab-icon" />
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "control"}
              className={`tab-button ${activeTab === "control" ? "active" : ""}`}
              onClick={() => setActiveTab("control")}
            >
              <Icon name="chip" className="tab-icon" />
              Control Deck
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "logs"}
              className={`tab-button ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              <Icon name="terminal" className="tab-icon" />
              Terminal
            </button>
          </div>

          <div className="tab-summary">
            <span>{totalLogLines} log lines buffered</span>
            <span>{config.acceptedRiskWarning ? "Ready to launch" : "Consent required"}</span>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="overview-grid">
            <section className="panel inner-panel">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Preset Intelligence</p>
                  <h2>Automatic routing and miner profile</h2>
                </div>
                <span className="section-chip subtle">Locked to unMineable presets</span>
              </div>

              <div className="preset-grid">
                <article className="preset-card gpu">
                  <div className="preset-topline">
                    <span className="preset-type">GPU lane</span>
                    <StatusBadge label="GPU" status={gpuStatus} />
                  </div>
                  <div className="preset-badges">
                    <span className={`coin-algo-badge ${selectedCoin === "RVN" ? "accent" : ""}`}>
                      KawPow
                    </span>
                    <span className="coin-algo-badge">{activeGpuBackend}</span>
                  </div>
                  <strong>{activeGpuBackend} / KawPow</strong>
                  <p>Host: {config.gpuPool.host}:{config.gpuPool.port}</p>
                  <p>Wallet string: {payoutPreview}</p>
                </article>

                <article className="preset-card cpu">
                  <div className="preset-topline">
                    <span className="preset-type">CPU lane</span>
                    <StatusBadge label="CPU" status={cpuStatus} />
                  </div>
                  <div className="preset-badges">
                    <span className="coin-algo-badge accent">RandomX</span>
                    <span className="coin-algo-badge">XMRig</span>
                  </div>
                  <strong>XMRig / RandomX</strong>
                  <p>Host: {config.cpuPool.host}:{config.cpuPool.port}</p>
                  <p>User string: {cpuUserPreview}</p>
                </article>
              </div>

              <div className="insight-list">
                <article className="insight-card">
                  <span className="insight-label">Exact preset behavior</span>
                  <strong>
                    {selectedCoin === "LTC"
                      ? "Litecoin payout mode"
                      : selectedCoin === "BTC"
                        ? "Bitcoin payout mode"
                        : selectedCoin === "RVN"
                          ? "Ravencoin payout mode"
                          : "Monero payout mode"}
                  </strong>
                  <p>
                    {selectedCoin === "LTC"
                      ? "GPU stays on KawPow while CPU stays on RandomX, both paying out to Litecoin."
                      : selectedCoin === "BTC"
                        ? "GPU and CPU mine their normal workloads while unMineable pays out to your Bitcoin address."
                      : selectedCoin === "RVN"
                          ? "RVN uses KawPow on the GPU lane and RandomX on the CPU lane while both pay out to your Ravencoin address."
                      : "GPU and CPU remain available while payout formatting and pool hosts stay automatic for Monero."}
                  </p>
                </article>

                {selectedCoin === "RVN" ? (
                  <article className="insight-card accent-card">
                    <span className="insight-label">RVN unMineable preset</span>
                    <strong>BzMiner + XMRig / KawPow + RandomX</strong>
                    <p>GPU: `kp.unmineable.com:3333` · CPU: `rx.unmineable.com:3333` · Wallet: `rvn:REYeMLf1GoKn3D4w8haFQjZFW6St4itq8P.{config.worker || "worker-01"}`</p>
                  </article>
                ) : null}

                <article className="insight-card">
                  <span className="insight-label">Runtime ownership</span>
                  <strong>Rust backend manages the miner lifecycle</strong>
                  <p>Process spawning, logging, and exit tracking stay in the native shell instead of the frontend.</p>
                </article>
              </div>
            </section>

            <section className="runtime-stack">
              <section className="panel stat-panel gpu-panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">GPU Runtime</p>
                    <h2>Graphics miner</h2>
                  </div>
                  <StatusBadge label="GPU" status={gpuStatus} />
                </div>
                <div className="stat-hero">
                  <div className="hashrate-card">
                    <span>Current hashrate</span>
                    <strong>{gpuHashrate}</strong>
                    <div className="sparkline" aria-hidden="true">
                      {(gpuHistory.length === 0 ? [0] : gpuHistory).map((point, index) => (
                        <span
                          key={`gpu-point-${index}`}
                          className="spark-bar"
                          style={{ height: `${Math.max(10, (point / gpuMaxHistory) * 100)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mini-facts">
                    <div>
                      <span>Mode</span>
                      <strong>KawPow</strong>
                    </div>
                    <div>
                      <span>Backend</span>
                      <strong>{activeGpuBackend}</strong>
                    </div>
                  </div>
                </div>
                <div className="debug-panel">
                  <div className="debug-header">
                    <span>Command line</span>
                    <button
                      type="button"
                      className="inline-action"
                      onClick={() => void copyText(gpuCommandLine, "GPU command")}
                    >
                      Copy
                    </button>
                  </div>
                  <code>{gpuCommandLine || "No GPU command yet."}</code>
                </div>
              </section>

              <section className="panel stat-panel cpu-panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">CPU Runtime</p>
                    <h2>Processor miner</h2>
                  </div>
                  <StatusBadge label="CPU" status={cpuStatus} />
                </div>
                <div className="stat-hero">
                  <div className="hashrate-card">
                    <span>Current hashrate</span>
                    <strong>{cpuHashrate}</strong>
                    <div className="sparkline" aria-hidden="true">
                      {(cpuHistory.length === 0 ? [0] : cpuHistory).map((point, index) => (
                        <span
                          key={`cpu-point-${index}`}
                          className="spark-bar"
                          style={{ height: `${Math.max(10, (point / cpuMaxHistory) * 100)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mini-facts">
                    <div>
                      <span>Mode</span>
                      <strong>RandomX</strong>
                    </div>
                    <div>
                      <span>Preset</span>
                      <strong>rx.unmineable.com</strong>
                    </div>
                  </div>
                </div>
                <div className="debug-panel">
                  <div className="debug-header">
                    <span>Command line</span>
                    <button
                      type="button"
                      className="inline-action"
                      onClick={() => void copyText(cpuCommandLine, "CPU command")}
                    >
                      Copy
                    </button>
                  </div>
                  <code>{cpuCommandLine || "No CPU command yet."}</code>
                </div>
              </section>
            </section>
          </div>
        ) : null}

        {activeTab === "control" ? (
          <div className="control-grid">
            <section className="panel inner-panel control-deck">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Mission Control</p>
                  <h2>Configure the mining profile</h2>
                </div>
                <span className="section-chip">Desktop workflow</span>
              </div>

              <div className="coin-selector" role="tablist" aria-label="Coin selection">
                {(["LTC", "XMR", "BTC", "RVN"] as SupportedCoin[]).map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    className={`coin-option ${selectedCoin === coin ? "active" : ""}`}
                    onClick={() => handleCoinChange(coin)}
                  >
                    <div className="coin-topline">
                      <span className="coin-symbol">{coin}</span>
                      <span className={`coin-algo-badge ${coin === "RVN" ? "accent" : ""}`}>
                        {coin === "RVN" ? "KawPow" : coin === "XMR" ? "RandomX + KawPow" : "unMineable Auto"}
                      </span>
                    </div>
                    <span className="coin-name">{COIN_LABELS[coin]}</span>
                    <span className="coin-note">
                      {coin === "LTC"
                        ? "GPU KawPow + CPU RandomX"
                        : coin === "BTC"
                          ? "GPU KawPow payout + CPU RandomX to Bitcoin"
                          : coin === "RVN"
                            ? "GPU KawPow + CPU RandomX to Ravencoin"
                          : "GPU KawPow payout + CPU RandomX"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="form-grid polished">
                <label className="field">
                  <span>{COIN_LABELS[selectedCoin]} Wallet</span>
                  <input type="text" value={config.wallet} readOnly />
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

                <div className="field preview-field wide">
                  <span>Payout identity</span>
                  <code>{payoutPreview}</code>
                </div>
              </div>

              <div className="toggle-stack">
                <label className="toggle-card emphasis">
                  <input
                    type="checkbox"
                    checked={config.acceptedRiskWarning}
                    onChange={(event) => updateField("acceptedRiskWarning", event.target.checked)}
                  />
                  <div>
                    <strong>Hardware risk acknowledged</strong>
                    <small>Required before launching miners. High heat, power draw, and sustained load are expected.</small>
                  </div>
                </label>

                <label className="toggle-card">
                  <input
                    type="checkbox"
                    checked={config.gpuEnabled}
                    onChange={(event) => updateField("gpuEnabled", event.target.checked)}
                  />
                  <div>
                    <strong>Enable GPU mining</strong>
                    <small>BzMiner on KawPow through `kp.unmineable.com` with your selected payout coin.</small>
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
                    <strong>Enable CPU mining</strong>
                    <small>
                      {selectedCoin === "RVN"
                        ? "XMRig runs RandomX through `rx.unmineable.com` while unMineable pays the CPU lane out in Ravencoin."
                        : "XMRig on RandomX through `rx.unmineable.com` with automatic user formatting."}
                    </small>
                  </div>
                </label>

                <label className="toggle-card">
                  <input
                    type="checkbox"
                    checked={config.autoStartOnLaunch}
                    onChange={(event) => updateField("autoStartOnLaunch", event.target.checked)}
                  />
                  <div>
                    <strong>Remember launch intent</strong>
                    <small>Stored locally in the app config so your preferred mode is preserved between sessions.</small>
                  </div>
                </label>
              </div>

              <div className="button-row">
                <button className="primary-button" disabled={busy} onClick={() => void handleStart()}>
                  Start Selected Miners
                </button>
                <button className="secondary-button" disabled={busy} onClick={() => void handleStop()}>
                  Stop Miners
                </button>
                <button className="secondary-button" disabled={busy} onClick={() => void handleCpuTest()}>
                  Dry-run CPU Path
                </button>
              </div>

              {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            </section>

            <section className="panel inner-panel operator-panel">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Operator Notes</p>
                  <h2>Current launch envelope</h2>
                </div>
                <span className="section-chip subtle">Read-only system guidance</span>
              </div>

              <div className="operator-list">
                <article className="operator-card">
                  <div className="operator-icon">
                    <Icon name="gpu" />
                  </div>
                  <div>
                    <strong>GPU command path</strong>
                    <p>KawPow routed through `kp.unmineable.com` using your selected payout identity. On your RTX 5060 Ti, BzMiner is the preferred backend.</p>
                  </div>
                </article>
                <article className="operator-card">
                  <div className="operator-icon">
                    <Icon name="cpu" />
                  </div>
                  <div>
                    <strong>CPU command path</strong>
                    <p>RandomX routed through `rx.unmineable.com` with automatic `user` formatting.</p>
                  </div>
                </article>
                <article className="operator-card">
                  <div className="operator-icon">
                    <Icon name="shield" />
                  </div>
                  <div>
                    <strong>Launch protection</strong>
                    <p>The app blocks start until the resource warning is accepted in the control deck.</p>
                  </div>
                </article>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="logs-grid deluxe terminal-layout">
            <LogPanel
              title="GPU Terminal"
              lines={gpuLogs}
              emptyMessage="GPU miner output will appear here."
            />
            <LogPanel
              title="CPU Terminal"
              lines={cpuLogs}
              emptyMessage="CPU miner output will appear here."
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
