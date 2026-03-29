use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Failed to create config directory: {0}")]
    DirectoryCreation(String),
    #[error("Failed to read config file: {0}")]
    Read(String),
    #[error("Failed to write config file: {0}")]
    Write(String),
    #[error("Failed to parse config file: {0}")]
    Parse(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuPoolConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuPoolConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub algo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub wallet: String,
    pub worker: String,
    pub payout_ticker: String,
    pub gpu_enabled: bool,
    pub cpu_enabled: bool,
    pub accepted_risk_warning: bool,
    pub auto_start_on_launch: bool,
    pub gpu_pool: GpuPoolConfig,
    pub cpu_pool: CpuPoolConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            wallet: String::new(),
            worker: "worker-01".into(),
            payout_ticker: "LTC".into(),
            gpu_enabled: true,
            cpu_enabled: false,
            accepted_risk_warning: false,
            auto_start_on_launch: false,
            gpu_pool: GpuPoolConfig {
                host: "kp.unmineable.com".into(),
                port: 3333,
            },
            cpu_pool: CpuPoolConfig {
                host: "pool.supportxmr.com".into(),
                port: 3333,
                user: String::new(),
                password: "x".into(),
                algo: "rx/0".into(),
            },
        }
    }
}

pub fn config_dir(app: &AppHandle) -> Result<PathBuf, ConfigError> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|error| ConfigError::DirectoryCreation(error.to_string()))?;

    fs::create_dir_all(&path).map_err(|error| ConfigError::DirectoryCreation(error.to_string()))?;
    Ok(path)
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf, ConfigError> {
    Ok(config_dir(app)?.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<AppConfig, ConfigError> {
    let path = config_path(app)?;
    if !path.exists() {
        let config = AppConfig::default();
        save_config(app, &config)?;
        return Ok(config);
    }

    let data = fs::read_to_string(path).map_err(|error| ConfigError::Read(error.to_string()))?;
    serde_json::from_str(&data).map_err(|error| ConfigError::Parse(error.to_string()))
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), ConfigError> {
    let path = config_path(app)?;
    let serialized = serde_json::to_string_pretty(config)
        .map_err(|error| ConfigError::Write(error.to_string()))?;
    fs::write(path, serialized).map_err(|error| ConfigError::Write(error.to_string()))
}

pub fn ensure_valid_wallet(config: &AppConfig) -> Result<(), ConfigError> {
    if config.wallet.trim().is_empty() {
        return Err(ConfigError::Parse("Wallet address cannot be empty.".into()));
    }

    Ok(())
}

pub fn sanitize_worker(worker: &str) -> String {
    let trimmed = worker.trim();
    if trimmed.is_empty() {
        "worker".into()
    } else {
        trimmed.into()
    }
}

pub fn normalize_cpu_user(config: &AppConfig) -> String {
    let user = config.cpu_pool.user.trim();
    if user.is_empty() {
        config.wallet.trim().into()
    } else {
        user.into()
    }
}

