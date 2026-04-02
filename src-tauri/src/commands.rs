use crate::config::{load_config, save_config, AppConfig};
use crate::miner_manager::{MinerManager, MinerSnapshot, StartMinerResponse};
use crate::tools::{detect_setup, SetupStatus};
use serde::Serialize;
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeState {
    pub config: AppConfig,
    pub setup: SetupStatus,
    pub gpu_status: MinerSnapshot,
    pub cpu_status: MinerSnapshot,
}

#[tauri::command]
pub fn load_runtime_state(
    app: AppHandle,
    manager: State<MinerManager>,
) -> Result<RuntimeState, String> {
    let config = load_config(&app).map_err(|error| error.to_string())?;
    let gpu_status = manager.gpu_status().map_err(|error| error.to_string())?;
    let cpu_status = manager.cpu_status().map_err(|error| error.to_string())?;

    Ok(RuntimeState {
        config,
        setup: detect_setup(),
        gpu_status,
        cpu_status,
    })
}

#[tauri::command]
pub fn save_config_command(app: AppHandle, config: AppConfig) -> Result<(), String> {
    save_config(&app, &config).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_gpu_miner(
    app: AppHandle,
    config: AppConfig,
    manager: State<MinerManager>,
) -> Result<StartMinerResponse, String> {
    save_config(&app, &config).map_err(|error| error.to_string())?;
    manager
        .start_gpu(app, config)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn stop_gpu_miner(app: AppHandle, manager: State<MinerManager>) -> Result<(), String> {
    manager.stop_gpu(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_gpu_miner_status(manager: State<MinerManager>) -> Result<MinerSnapshot, String> {
    manager.gpu_status().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_cpu_miner(
    app: AppHandle,
    config: AppConfig,
    manager: State<MinerManager>,
) -> Result<StartMinerResponse, String> {
    save_config(&app, &config).map_err(|error| error.to_string())?;
    manager
        .start_cpu(app, config)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn stop_cpu_miner(app: AppHandle, manager: State<MinerManager>) -> Result<(), String> {
    manager.stop_cpu(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_cpu_miner_status(manager: State<MinerManager>) -> Result<MinerSnapshot, String> {
    manager.cpu_status().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_cpu_miner_test(
    app: AppHandle,
    config: AppConfig,
    manager: State<MinerManager>,
) -> Result<StartMinerResponse, String> {
    save_config(&app, &config).map_err(|error| error.to_string())?;
    manager
        .start_cpu_test(app, config)
        .map_err(|error| error.to_string())
}
