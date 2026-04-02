use crate::config::{apply_coin_preset, build_payout_user, normalize_cpu_user, AppConfig};
use crate::tools::{cpu_miner_path, gpu_miner_path};

#[derive(Debug, Clone)]
pub struct BuiltCommand {
    pub executable: String,
    pub args: Vec<String>,
}

impl BuiltCommand {
    pub fn command_line(&self) -> String {
        let mut parts = vec![self.executable.clone()];
        parts.extend(self.args.clone());
        parts.join(" ")
    }
}

pub fn build_gpu_command(config: &AppConfig) -> BuiltCommand {
    let config = apply_coin_preset(config.clone());
    let wallet_string = build_payout_user(&config);

    BuiltCommand {
        executable: gpu_miner_path().to_string_lossy().into_owned(),
        args: vec![
            "-a".into(),
            "kawpow".into(),
            "-p".into(),
            format!(
                "stratum+tcp://{}:{}",
                config.gpu_pool.host.trim(),
                config.gpu_pool.port
            ),
            "-w".into(),
            wallet_string,
            "-i".into(),
            "32".into(),
        ],
    }
}

pub fn build_cpu_command(config: &AppConfig) -> BuiltCommand {
    let config = apply_coin_preset(config.clone());

    BuiltCommand {
        executable: cpu_miner_path().to_string_lossy().into_owned(),
        args: vec![
            "-a".into(),
            config.cpu_pool.algo.trim().into(),
            "-o".into(),
            format!("{}:{}", config.cpu_pool.host.trim(), config.cpu_pool.port),
            "-u".into(),
            normalize_cpu_user(&config),
            "-p".into(),
            config.cpu_pool.password.trim().into(),
            "-4".into(),
            "--cpu-max-threads-hint=100".into(),
            "--cpu-no-yield".into(),
            "--dns-ipv6".into(),
            "0".into(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::build_cpu_command;
    use crate::config::{AppConfig, CpuPoolConfig, GpuPoolConfig};

    fn sample_config() -> AppConfig {
        AppConfig {
            wallet: "wallet123".into(),
            worker: "worker-a".into(),
            payout_ticker: "LTC".into(),
            gpu_enabled: true,
            cpu_enabled: true,
            accepted_risk_warning: true,
            auto_start_on_launch: false,
            gpu_pool: GpuPoolConfig {
                host: "kp.unmineable.com".into(),
                port: 3333,
            },
            cpu_pool: CpuPoolConfig {
                host: "rx.unmineable.com".into(),
                port: 3333,
                user: String::new(),
                password: "x".into(),
                algo: "rx/0".into(),
            },
        }
    }

    #[test]
    fn build_cpu_command_uses_split_dns_ipv6_args() {
        let command = build_cpu_command(&sample_config());

        assert!(command
            .args
            .windows(2)
            .any(|window| { window[0] == "--dns-ipv6" && window[1] == "0" }));
        assert!(!command.args.iter().any(|arg| arg == "-- dns-ipv6=0"));
        assert!(!command.args.iter().any(|arg| arg == "---dns-ipv6=0"));
    }

    #[test]
    fn build_cpu_command_enables_max_cpu_load_flags() {
        let command = build_cpu_command(&sample_config());

        assert!(command.args.iter().any(|arg| arg == "-4"));
        assert!(command
            .args
            .iter()
            .any(|arg| arg == "--cpu-max-threads-hint=100"));
        assert!(command.args.iter().any(|arg| arg == "--cpu-no-yield"));
    }

    #[test]
    fn build_gpu_command_enables_max_intensity() {
        let command = super::build_gpu_command(&sample_config());

        assert!(command
            .args
            .windows(2)
            .any(|window| window[0] == "-i" && window[1] == "32"));
    }

    #[test]
    fn build_cpu_command_uses_unmineable_coin_prefixed_user() {
        let command = build_cpu_command(&sample_config());

        assert!(command.args.windows(2).any(|window| {
            window[0] == "-u" && window[1] == "ltc:LQVQY35YkdmGE1PtqfaRbEHox3MZbWKrZa.worker-a"
        }));
    }

    #[test]
    fn build_gpu_command_supports_bitcoin_payout_strings() {
        let mut config = sample_config();
        config.payout_ticker = "BTC".into();

        let command = super::build_gpu_command(&config);

        assert!(command.args.windows(2).any(|window| {
            window[0] == "-w"
                && window[1] == "btc:bc1qs3wn9rudzj3crl9yvck7ajfh0kavnffqsq037s.worker-a"
        }));
    }

    #[test]
    fn build_gpu_command_supports_ravencoin_payout_strings() {
        let mut config = sample_config();
        config.payout_ticker = "RVN".into();

        let command = super::build_gpu_command(&config);

        assert!(command.args.windows(2).any(|window| {
            window[0] == "-w" && window[1] == "rvn:REYeMLf1GoKn3D4w8haFQjZFW6St4itq8P.worker-a"
        }));
        assert!(
            command.executable.ends_with("bzminer.exe") || command.executable.ends_with("bzminer")
        );
    }
}
