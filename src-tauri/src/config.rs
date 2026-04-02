use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use thiserror::Error;

pub const DEFAULT_BTC_WALLET: &str = "bc1qs3wn9rudzj3crl9yvck7ajfh0kavnffqsq037s";
pub const DEFAULT_LTC_WALLET: &str = "LQVQY35YkdmGE1PtqfaRbEHox3MZbWKrZa";
pub const DEFAULT_RVN_WALLET: &str = "REYeMLf1GoKn3D4w8haFQjZFW6St4itq8P";
pub const DEFAULT_XMR_WALLET: &str =
    "47szZ9FmKjPh8uBf9G5QwvYTjuVaqT8FEZ9NWpSebw7oDZAcL9aNzDNdq3GUk7ky5SP8jEC751jaR7AviABRNrXrGQoD5Ru";

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
#[serde(default, rename_all = "camelCase")]
pub struct GpuPoolConfig {
    pub host: String,
    pub port: u16,
}

impl Default for GpuPoolConfig {
    fn default() -> Self {
        Self {
            host: "kp.unmineable.com".into(),
            port: 3333,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct CpuPoolConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub algo: String,
}

impl Default for CpuPoolConfig {
    fn default() -> Self {
        Self {
            host: "rx.unmineable.com".into(),
            port: 3333,
            user: String::new(),
            password: "x".into(),
            algo: "rx/0".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
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
        apply_coin_preset(Self {
            wallet: String::new(),
            worker: "worker-01".into(),
            payout_ticker: "LTC".into(),
            gpu_enabled: true,
            cpu_enabled: false,
            accepted_risk_warning: false,
            auto_start_on_launch: false,
            gpu_pool: GpuPoolConfig::default(),
            cpu_pool: CpuPoolConfig::default(),
        })
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

pub fn sanitize_payout_ticker(value: &str) -> String {
    if value.trim().eq_ignore_ascii_case("BTC") {
        "BTC".into()
    } else if value.trim().eq_ignore_ascii_case("RVN") {
        "RVN".into()
    } else if value.trim().eq_ignore_ascii_case("XMR") {
        "XMR".into()
    } else {
        "LTC".into()
    }
}

pub fn default_wallet_for_coin(payout_ticker: &str) -> &'static str {
    match sanitize_payout_ticker(payout_ticker).as_str() {
        "BTC" => DEFAULT_BTC_WALLET,
        "RVN" => DEFAULT_RVN_WALLET,
        "XMR" => DEFAULT_XMR_WALLET,
        _ => DEFAULT_LTC_WALLET,
    }
}

pub fn build_payout_user(config: &AppConfig) -> String {
    format!(
        "{}:{}.{}",
        sanitize_payout_ticker(&config.payout_ticker).to_lowercase(),
        config.wallet.trim(),
        sanitize_worker(&config.worker)
    )
}

pub fn apply_coin_preset(mut config: AppConfig) -> AppConfig {
    config.payout_ticker = sanitize_payout_ticker(&config.payout_ticker);
    config.wallet = default_wallet_for_coin(&config.payout_ticker).into();
    config.gpu_pool = GpuPoolConfig::default();
    config.cpu_pool = CpuPoolConfig {
        user: build_payout_user(&config),
        ..CpuPoolConfig::default()
    };
    if config.payout_ticker == "RVN" {
        config.cpu_enabled = false;
    }

    config
}

pub fn normalize_cpu_user(config: &AppConfig) -> String {
    if config
        .cpu_pool
        .host
        .trim()
        .eq_ignore_ascii_case("rx.unmineable.com")
    {
        return build_payout_user(config);
    }

    let user = config.cpu_pool.user.trim();
    if user.is_empty() {
        config.wallet.trim().into()
    } else {
        user.into()
    }
}
