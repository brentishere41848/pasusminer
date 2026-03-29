use crate::command_builder::{build_cpu_command, build_gpu_command, BuiltCommand};
use crate::config::{ensure_valid_wallet, AppConfig};
use crate::log_parser::parse_hashrate;
use crate::tools::detect_setup;
use serde::Serialize;
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MinerKind {
    Gpu,
    Cpu,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BackendMinerStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MinerSnapshot {
    pub miner: MinerKind,
    pub status: BackendMinerStatus,
    pub command_line: Option<String>,
    pub pid: Option<u32>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartMinerResponse {
    pub started: bool,
    pub already_running: bool,
    pub status: MinerSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MinerLogEvent {
    miner: MinerKind,
    line: String,
    stream: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MinerStatusEvent {
    miner: MinerKind,
    status: BackendMinerStatus,
    message: Option<String>,
    command_line: Option<String>,
    pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HashrateEvent {
    miner: MinerKind,
    hashrate: String,
    raw_line: String,
}

#[derive(Debug, Error)]
pub enum MinerManagerError {
    #[error("Wallet address is invalid.")]
    InvalidWallet,
    #[error("GPU miner executable is missing.")]
    MissingGpuExecutable,
    #[error("CPU miner executable is missing.")]
    MissingCpuExecutable,
    #[error("Failed to spawn miner process: {0}")]
    Spawn(String),
    #[error("Failed to stop miner process: {0}")]
    Stop(String),
}

struct ManagedProcess {
    child: Arc<Mutex<Child>>,
}

struct MinerRuntime {
    status: BackendMinerStatus,
    command_line: Option<String>,
    pid: Option<u32>,
    message: Option<String>,
    process: Option<ManagedProcess>,
    stop_requested: bool,
}

impl MinerRuntime {
    fn new() -> Self {
        Self {
            status: BackendMinerStatus::Stopped,
            command_line: None,
            pid: None,
            message: None,
            process: None,
            stop_requested: false,
        }
    }

    fn snapshot(&self, miner: MinerKind) -> MinerSnapshot {
        MinerSnapshot {
            miner,
            status: self.status,
            command_line: self.command_line.clone(),
            pid: self.pid,
            message: self.message.clone(),
        }
    }
}

pub struct MinerManager {
    gpu: Arc<Mutex<MinerRuntime>>,
    cpu: Arc<Mutex<MinerRuntime>>,
}

impl MinerManager {
    pub fn new() -> Self {
        Self {
            gpu: Arc::new(Mutex::new(MinerRuntime::new())),
            cpu: Arc::new(Mutex::new(MinerRuntime::new())),
        }
    }

    pub fn start_gpu(
        &self,
        app: AppHandle,
        config: AppConfig,
    ) -> Result<StartMinerResponse, MinerManagerError> {
        ensure_valid_wallet(&config).map_err(|_| MinerManagerError::InvalidWallet)?;
        let setup = detect_setup();
        if !setup.gpu.exists {
            return Err(MinerManagerError::MissingGpuExecutable);
        }

        self.start_managed_process(app, MinerKind::Gpu, self.gpu.clone(), build_gpu_command(&config))
    }

    pub fn start_cpu(
        &self,
        app: AppHandle,
        config: AppConfig,
    ) -> Result<StartMinerResponse, MinerManagerError> {
        ensure_valid_wallet(&config).map_err(|_| MinerManagerError::InvalidWallet)?;
        let setup = detect_setup();
        if !setup.cpu.exists {
            return Err(MinerManagerError::MissingCpuExecutable);
        }

        self.start_managed_process(app, MinerKind::Cpu, self.cpu.clone(), build_cpu_command(&config))
    }

    pub fn stop_gpu(&self, app: &AppHandle) -> Result<(), MinerManagerError> {
        self.stop_managed_process(app, MinerKind::Gpu, self.gpu.clone())
    }

    pub fn stop_cpu(&self, app: &AppHandle) -> Result<(), MinerManagerError> {
        self.stop_managed_process(app, MinerKind::Cpu, self.cpu.clone())
    }

    pub fn gpu_status(&self) -> Result<MinerSnapshot, MinerManagerError> {
        self.snapshot(MinerKind::Gpu, self.gpu.clone())
    }

    pub fn cpu_status(&self) -> Result<MinerSnapshot, MinerManagerError> {
        self.snapshot(MinerKind::Cpu, self.cpu.clone())
    }

    pub fn start_cpu_test(
        &self,
        app: AppHandle,
        config: AppConfig,
    ) -> Result<StartMinerResponse, MinerManagerError> {
        emit_manager_log(
            &app,
            MinerKind::Cpu,
            "info",
            "manual backend test command invoked",
        );
        self.start_cpu(app, config)
    }

    fn snapshot(
        &self,
        miner: MinerKind,
        runtime: Arc<Mutex<MinerRuntime>>,
    ) -> Result<MinerSnapshot, MinerManagerError> {
        let runtime = runtime
            .lock()
            .map_err(|error| MinerManagerError::Stop(error.to_string()))?;
        Ok(runtime.snapshot(miner))
    }

    fn start_managed_process(
        &self,
        app: AppHandle,
        miner: MinerKind,
        runtime: Arc<Mutex<MinerRuntime>>,
        command: BuiltCommand,
    ) -> Result<StartMinerResponse, MinerManagerError> {
        let command_line = command.command_line();
        emit_manager_log(&app, miner, "info", "start requested");
        emit_manager_log(
            &app,
            miner,
            "info",
            &format!("exact command line used: {command_line}"),
        );
        emit_manager_log(
            &app,
            miner,
            "info",
            &format!("final argument array: {:?}", command.args),
        );

        {
            let mut runtime_guard = runtime
                .lock()
                .map_err(|error| MinerManagerError::Spawn(error.to_string()))?;

            if matches!(
                runtime_guard.status,
                BackendMinerStatus::Starting | BackendMinerStatus::Running | BackendMinerStatus::Stopping
            ) && runtime_guard.process.is_some()
            {
                runtime_guard.message = Some("already running".into());
                emit_status(&app, miner, &runtime_guard);
                return Ok(StartMinerResponse {
                    started: false,
                    already_running: true,
                    status: runtime_guard.snapshot(miner),
                });
            }

            runtime_guard.status = BackendMinerStatus::Starting;
            runtime_guard.command_line = Some(command_line.clone());
            runtime_guard.message = Some("start requested".into());
            runtime_guard.stop_requested = false;
            emit_status(&app, miner, &runtime_guard);
        }

        let mut child = Command::new(&command.executable)
            .args(&command.args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| MinerManagerError::Spawn(error.to_string()))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let pid = child.id();
        let child = Arc::new(Mutex::new(child));

        {
            let mut runtime_guard = runtime
                .lock()
                .map_err(|error| MinerManagerError::Spawn(error.to_string()))?;
            runtime_guard.status = BackendMinerStatus::Running;
            runtime_guard.command_line = Some(command_line.clone());
            runtime_guard.pid = Some(pid);
            runtime_guard.message = Some("process spawned".into());
            runtime_guard.stop_requested = false;
            runtime_guard.process = Some(ManagedProcess {
                child: child.clone(),
            });
            emit_status(&app, miner, &runtime_guard);
        }

        emit_manager_log(&app, miner, "info", &format!("process spawned with pid {pid}"));

        if let Some(stdout) = stdout {
            stream_output(app.clone(), miner, stdout, "stdout");
        }

        if let Some(stderr) = stderr {
            stream_output(app.clone(), miner, stderr, "stderr");
        }

        watch_exit(app.clone(), miner, runtime.clone(), child);

        let runtime_guard = runtime
            .lock()
            .map_err(|error| MinerManagerError::Spawn(error.to_string()))?;

        Ok(StartMinerResponse {
            started: true,
            already_running: false,
            status: runtime_guard.snapshot(miner),
        })
    }

    fn stop_managed_process(
        &self,
        app: &AppHandle,
        miner: MinerKind,
        runtime: Arc<Mutex<MinerRuntime>>,
    ) -> Result<(), MinerManagerError> {
        let child = {
            let mut runtime_guard = runtime
                .lock()
                .map_err(|error| MinerManagerError::Stop(error.to_string()))?;

            let Some(child) = runtime_guard.process.as_ref().map(|process| process.child.clone()) else {
                runtime_guard.status = BackendMinerStatus::Stopped;
                runtime_guard.message = Some("already stopped".into());
                emit_status(app, miner, &runtime_guard);
                return Ok(());
            };

            runtime_guard.status = BackendMinerStatus::Stopping;
            runtime_guard.message = Some("stop requested".into());
            runtime_guard.stop_requested = true;
            emit_status(app, miner, &runtime_guard);
            emit_manager_log(app, miner, "info", "stop requested");
            child
        };

        if let Ok(mut child_guard) = child.lock() {
            match child_guard.kill() {
                Ok(()) => emit_manager_log(app, miner, "info", "process killed by app"),
                Err(error) => emit_manager_log(
                    app,
                    miner,
                    "warn",
                    &format!("kill request returned error: {error}"),
                ),
            }
        }

        Ok(())
    }
}

fn stream_output<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    miner: MinerKind,
    reader: R,
    stream: &str,
) {
    let stream_name = stream.to_string();
    thread::spawn(move || {
        let buffered = BufReader::new(reader);
        for line in buffered.lines().map_while(Result::ok) {
            emit_manager_log(&app, miner, "debug", &format!("{stream_name} line: {line}"));
            let _ = app.emit(
                "miner-log",
                MinerLogEvent {
                    miner,
                    line: line.clone(),
                    stream: stream_name.clone(),
                },
            );

            if let Some(hashrate) = parse_hashrate(&line) {
                let _ = app.emit(
                    "miner-hashrate",
                    HashrateEvent {
                        miner,
                        hashrate,
                        raw_line: line,
                    },
                );
            }
        }
    });
}

fn watch_exit(
    app: AppHandle,
    miner: MinerKind,
    runtime: Arc<Mutex<MinerRuntime>>,
    child: Arc<Mutex<Child>>,
) {
    thread::spawn(move || loop {
        let exit_status = {
            let mut child_guard = match child.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            match child_guard.try_wait() {
                Ok(Some(status)) => Some(Ok(status)),
                Ok(None) => None,
                Err(error) => Some(Err(error.to_string())),
            }
        };

        match exit_status {
            Some(Ok(status)) => {
                let mut runtime_guard = match runtime.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };

                emit_manager_log(
                    &app,
                    miner,
                    "info",
                    &format!("process exited with code {:?}", status.code()),
                );

                runtime_guard.process = None;
                runtime_guard.pid = None;
                if runtime_guard.stop_requested {
                    runtime_guard.status = BackendMinerStatus::Stopped;
                    runtime_guard.message = Some("process stopped".into());
                } else if status.success() {
                    runtime_guard.status = BackendMinerStatus::Stopped;
                    runtime_guard.message = Some("process exited".into());
                } else {
                    runtime_guard.status = BackendMinerStatus::Failed;
                    runtime_guard.message =
                        Some(format!("process exited unexpectedly with code {:?}", status.code()));
                }
                runtime_guard.stop_requested = false;
                emit_status(&app, miner, &runtime_guard);
                return;
            }
            Some(Err(error)) => {
                let mut runtime_guard = match runtime.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };
                runtime_guard.process = None;
                runtime_guard.pid = None;
                runtime_guard.status = BackendMinerStatus::Failed;
                runtime_guard.message = Some(format!("failed to monitor process: {error}"));
                runtime_guard.stop_requested = false;
                emit_manager_log(&app, miner, "error", &format!("watcher failed: {error}"));
                emit_status(&app, miner, &runtime_guard);
                return;
            }
            None => thread::sleep(Duration::from_millis(500)),
        }
    });
}

fn emit_status(app: &AppHandle, miner: MinerKind, runtime: &MinerRuntime) {
    let _ = app.emit(
        "miner-status",
        MinerStatusEvent {
            miner,
            status: runtime.status,
            message: runtime.message.clone(),
            command_line: runtime.command_line.clone(),
            pid: runtime.pid,
        },
    );
}

fn emit_manager_log(app: &AppHandle, miner: MinerKind, level: &str, message: &str) {
    let _ = app.emit(
        "miner-log",
        MinerLogEvent {
            miner,
            line: format!("[backend:{level}] {message}"),
            stream: "backend".into(),
        },
    );
}
