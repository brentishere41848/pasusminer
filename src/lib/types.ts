export type MinerKind = "gpu" | "cpu";
export type MinerStatus = "stopped" | "starting" | "running" | "stopping" | "failed";

export interface GpuPoolConfig {
  host: string;
  port: number;
}

export interface CpuPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  algo: string;
}

export interface AppConfig {
  wallet: string;
  worker: string;
  payoutTicker: string;
  gpuEnabled: boolean;
  cpuEnabled: boolean;
  acceptedRiskWarning: boolean;
  autoStartOnLaunch: boolean;
  gpuPool: GpuPoolConfig;
  cpuPool: CpuPoolConfig;
}

export interface ToolAvailability {
  exists: boolean;
  path: string;
}

export interface SetupStatus {
  gpu: ToolAvailability;
  cpu: ToolAvailability;
}

export interface RuntimeState {
  config: AppConfig;
  setup: SetupStatus;
  gpuStatus: MinerSnapshot;
  cpuStatus: MinerSnapshot;
}

export interface MinerSnapshot {
  miner: MinerKind;
  status: MinerStatus;
  commandLine?: string | null;
  pid?: number | null;
  message?: string | null;
}

export interface StartMinerResponse {
  started: boolean;
  alreadyRunning: boolean;
  status: MinerSnapshot;
}

export interface MinerEventPayload {
  miner: MinerKind;
  line: string;
  stream?: "stdout" | "stderr";
}

export interface MinerStatusEvent {
  miner: MinerKind;
  status: MinerStatus;
  message?: string;
  commandLine?: string | null;
  pid?: number | null;
}

export interface HashrateEvent {
  miner: MinerKind;
  hashrate: string;
  rawLine: string;
}
