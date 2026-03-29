import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, MinerSnapshot, RuntimeState, StartMinerResponse } from "./types";

export async function loadRuntimeState(): Promise<RuntimeState> {
  return invoke<RuntimeState>("load_runtime_state");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke("save_config_command", { config });
}

export async function startGpuMiner(config: AppConfig): Promise<StartMinerResponse> {
  return invoke<StartMinerResponse>("start_gpu_miner", { config });
}

export async function stopGpuMiner(): Promise<void> {
  await invoke("stop_gpu_miner");
}

export async function getGpuMinerStatus(): Promise<MinerSnapshot> {
  return invoke<MinerSnapshot>("get_gpu_miner_status");
}

export async function startCpuMiner(config: AppConfig): Promise<StartMinerResponse> {
  return invoke<StartMinerResponse>("start_cpu_miner", { config });
}

export async function stopCpuMiner(): Promise<void> {
  await invoke("stop_cpu_miner");
}

export async function getCpuMinerStatus(): Promise<MinerSnapshot> {
  return invoke<MinerSnapshot>("get_cpu_miner_status");
}

export async function startCpuMinerTest(config: AppConfig): Promise<StartMinerResponse> {
  return invoke<StartMinerResponse>("start_cpu_miner_test", { config });
}
