mod command_builder;
mod commands;
mod config;
mod log_parser;
mod miner_manager;
mod tools;

use commands::{
    get_cpu_miner_status, get_gpu_miner_status, load_runtime_state, save_config_command,
    start_cpu_miner, start_cpu_miner_test, start_gpu_miner, stop_cpu_miner, stop_gpu_miner,
};
use miner_manager::MinerManager;

fn main() {
    tauri::Builder::default()
        .manage(MinerManager::new())
        .invoke_handler(tauri::generate_handler![
            load_runtime_state,
            save_config_command,
            start_gpu_miner,
            stop_gpu_miner,
            get_gpu_miner_status,
            start_cpu_miner,
            stop_cpu_miner,
            get_cpu_miner_status,
            start_cpu_miner_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pasus Miner");
}
