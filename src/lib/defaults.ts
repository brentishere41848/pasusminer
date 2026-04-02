import { applyCoinPreset } from "./coins";
import type { AppConfig, RuntimeState } from "./types";

export const defaultConfig: AppConfig = applyCoinPreset({
  wallet: "",
  worker: "worker-01",
  payoutTicker: "LTC",
  gpuEnabled: true,
  cpuEnabled: false,
  acceptedRiskWarning: false,
  autoStartOnLaunch: false,
  gpuPool: {
    host: "kp.unmineable.com",
    port: 3333
  },
  cpuPool: {
    host: "rx.unmineable.com",
    port: 3333,
    user: "",
    password: "x",
    algo: "rx/0"
  }
}, "LTC");

export const emptyRuntimeState: RuntimeState = {
  config: defaultConfig,
  setup: {
    gpu: { exists: false, path: "" },
    cpu: { exists: false, path: "" }
  },
  gpuStatus: {
    miner: "gpu",
    status: "stopped",
    commandLine: null,
    pid: null,
    message: null
  },
  cpuStatus: {
    miner: "cpu",
    status: "stopped",
    commandLine: null,
    pid: null,
    message: null
  }
};
