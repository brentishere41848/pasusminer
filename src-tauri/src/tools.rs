use serde::Serialize;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

static BUNDLED_TOOLS_DIR: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolAvailability {
    pub exists: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub gpu: ToolAvailability,
    pub cpu: ToolAvailability,
}

pub fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map_or_else(|| PathBuf::from("."), |path| path.to_path_buf())
}

pub fn configure_bundled_tools_dir(app: &AppHandle) {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_dir = resource_dir.join("tools");
        let _ = BUNDLED_TOOLS_DIR.set(bundled_dir);
    }
}

fn gpu_miner_file_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "bzminer.exe"
    } else {
        "bzminer"
    }
}

fn cpu_miner_file_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "xmrig.exe"
    } else {
        "xmrig"
    }
}

fn candidate_tool_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(explicit) = std::env::var("PASUS_MINER_TOOLS_DIR") {
        roots.push(PathBuf::from(explicit));
    }

    if let Some(bundled_dir) = BUNDLED_TOOLS_DIR.get() {
        roots.push(bundled_dir.clone());
    }

    roots.push(project_root().join("tools"));

    if let Ok(current_dir) = std::env::current_dir() {
        roots.push(current_dir.join("tools"));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            roots.push(exe_dir.join("tools"));
            if let Some(parent) = exe_dir.parent() {
                roots.push(parent.join("tools"));
            }
        }
    }

    let mut unique = Vec::new();
    for root in roots {
        if !unique.iter().any(|existing: &PathBuf| existing == &root) {
            unique.push(root);
        }
    }

    unique
}

fn resolve_tool_path(relative_path: &[&str]) -> PathBuf {
    for root in candidate_tool_roots() {
        let candidate = relative_path.iter().fold(root.clone(), |path, segment| path.join(segment));
        if candidate.exists() {
            return candidate;
        }
    }

    relative_path
        .iter()
        .fold(project_root().join("tools"), |path, segment| path.join(segment))
}

pub fn gpu_miner_path() -> PathBuf {
    resolve_tool_path(&["gpu", gpu_miner_file_name()])
}

pub fn cpu_miner_path() -> PathBuf {
    resolve_tool_path(&["cpu", cpu_miner_file_name()])
}

pub fn detect_setup() -> SetupStatus {
    let gpu_path = gpu_miner_path();
    let cpu_path = cpu_miner_path();

    SetupStatus {
        gpu: ToolAvailability {
            exists: gpu_path.exists(),
            path: gpu_path.to_string_lossy().into_owned(),
        },
        cpu: ToolAvailability {
            exists: cpu_path.exists(),
            path: cpu_path.to_string_lossy().into_owned(),
        },
    }
}
