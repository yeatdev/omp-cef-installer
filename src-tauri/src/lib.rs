use futures_util::StreamExt;
use serde::Serialize;
use std::fs;
use std::io::{self, Write};
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

// ─── Response Types ──────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct VersionResult {
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct InstallResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct UninstallResult {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct InstallationCheck {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ProgressPayload {
    pub status: String,
    pub percent: u32,
}

// ─── Commands ────────────────────────────────────────────────

#[tauri::command]
async fn select_directory(app: AppHandle) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("Select GTA San Andreas Directory")
        .pick_folder(move |folder_path| {
            let path = folder_path.map(|p| p.to_string());
            let _ = tx.send(path);
        });
    rx.recv().unwrap_or(None)
}

/// Fetches the latest CEF version from GitHub
#[tauri::command]
async fn get_remote_version() -> VersionResult {
    let url = format!(
        "https://raw.githubusercontent.com/yeatdev/omp-cef-installer/main/version.txt?t={}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );

    match reqwest::get(&url).await {
        Ok(response) => {
            if !response.status().is_success() {
                return VersionResult {
                    success: false,
                    version: None,
                    error: Some(format!("HTTP error: {}", response.status())),
                };
            }
            match response.text().await {
                Ok(text) => VersionResult {
                    success: true,
                    version: Some(text.trim().to_string()),
                    error: None,
                },
                Err(e) => VersionResult {
                    success: false,
                    version: None,
                    error: Some(e.to_string()),
                },
            }
        }
        Err(e) => VersionResult {
            success: false,
            version: None,
            error: Some(e.to_string()),
        },
    }
}

/// Checks if CEF is installed in the given directory
#[tauri::command]
async fn check_installation(target_path: String) -> InstallationCheck {
    let asi_path = Path::new(&target_path).join("cef.asi");
    let version_file = Path::new(&target_path).join("cef-version.txt");

    if asi_path.exists() {
        let version = if version_file.exists() {
            fs::read_to_string(&version_file)
                .ok()
                .map(|v| v.trim().to_string())
        } else {
            Some("Unknown".to_string())
        };

        InstallationCheck {
            installed: true,
            version,
        }
    } else {
        InstallationCheck {
            installed: false,
            version: None,
        }
    }
}

/// Downloads and installs CEF files to the target directory
#[tauri::command]
async fn install_cef(
    app: AppHandle,
    target_path: String,
    version: String,
) -> InstallResult {
    let download_url = format!(
        "https://github.com/aurora-mp/omp-cef/releases/download/v{}/client-files-v{}.zip",
        version, version
    );

    // Emit initial progress
    let _ = app.emit("install-progress", ProgressPayload {
        status: "Downloading...".to_string(),
        percent: 0,
    });

    // Start download with streaming
    let response = match reqwest::get(&download_url).await {
        Ok(r) => {
            if !r.status().is_success() {
                return InstallResult {
                    success: false,
                    error: Some(format!("HTTP error: {}", r.status())),
                };
            }
            r
        }
        Err(e) => {
            return InstallResult {
                success: false,
                error: Some(format!("Download failed: {}", e)),
            };
        }
    };

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                downloaded += chunk.len() as u64;
                buffer.extend_from_slice(&chunk);

                let percent = if total_size > 0 {
                    ((downloaded as f64 / total_size as f64) * 100.0) as u32
                } else {
                    50
                };

                let status = if total_size > 0 {
                    format!("Downloading... {}%", percent)
                } else {
                    format!(
                        "Downloading... ({:.2} MB)",
                        downloaded as f64 / 1024.0 / 1024.0
                    )
                };

                let _ = app.emit("install-progress", ProgressPayload {
                    status,
                    percent,
                });
            }
            Err(e) => {
                return InstallResult {
                    success: false,
                    error: Some(format!("Download stream error: {}", e)),
                };
            }
        }
    }

    // Extract zip from memory
    let _ = app.emit("install-progress", ProgressPayload {
        status: "Extracting files...".to_string(),
        percent: 100,
    });

    let target = Path::new(&target_path);
    let cursor = io::Cursor::new(&buffer);

    match zip::ZipArchive::new(cursor) {
        Ok(mut archive) => {
            for i in 0..archive.len() {
                let mut file = match archive.by_index(i) {
                    Ok(f) => f,
                    Err(e) => {
                        return InstallResult {
                            success: false,
                            error: Some(format!("Zip entry error: {}", e)),
                        };
                    }
                };

                let out_path = match file.enclosed_name() {
                    Some(name) => target.join(name),
                    None => continue,
                };

                if file.is_dir() {
                    let _ = fs::create_dir_all(&out_path);
                } else {
                    if let Some(parent) = out_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let mut out_file = match fs::File::create(&out_path) {
                        Ok(f) => f,
                        Err(e) => {
                            return InstallResult {
                                success: false,
                                error: Some(format!("File create error: {}", e)),
                            };
                        }
                    };
                    let mut buf = [0u8; 8192];
                    loop {
                        let n = match std::io::Read::read(&mut file, &mut buf) {
                            Ok(0) => break,
                            Ok(n) => n,
                            Err(e) => {
                                return InstallResult {
                                    success: false,
                                    error: Some(format!("Extract read error: {}", e)),
                                };
                            }
                        };
                        if let Err(e) = out_file.write_all(&buf[..n]) {
                            return InstallResult {
                                success: false,
                                error: Some(format!("Extract write error: {}", e)),
                            };
                        }
                    }
                }
            }
        }
        Err(e) => {
            return InstallResult {
                success: false,
                error: Some(format!("Zip extraction failed: {}", e)),
            };
        }
    }

    // Write version file
    let _ = app.emit("install-progress", ProgressPayload {
        status: "Finalizing...".to_string(),
        percent: 100,
    });

    let version_path = target.join("cef-version.txt");
    if let Err(e) = fs::write(&version_path, &version) {
        return InstallResult {
            success: false,
            error: Some(format!("Failed to write version file: {}", e)),
        };
    }

    InstallResult {
        success: true,
        error: None,
    }
}

/// Uninstalls CEF from the target directory
#[tauri::command]
async fn uninstall_cef(target_path: String) -> UninstallResult {
    let target = Path::new(&target_path);
    let asi_path = target.join("cef.asi");
    let cef_dir = target.join("cef");
    let version_file = target.join("cef-version.txt");

    let mut removed = false;

    if asi_path.exists() {
        if let Err(e) = fs::remove_file(&asi_path) {
            return UninstallResult {
                success: false,
                message: None,
                error: Some(format!("Failed to remove cef.asi: {}", e)),
            };
        }
        removed = true;
    }

    if cef_dir.exists() {
        if let Err(e) = fs::remove_dir_all(&cef_dir) {
            return UninstallResult {
                success: false,
                message: None,
                error: Some(format!("Failed to remove cef directory: {}", e)),
            };
        }
        removed = true;
    }

    if version_file.exists() {
        let _ = fs::remove_file(&version_file);
    }

    if removed {
        UninstallResult {
            success: true,
            message: Some("Successfully uninstalled Open.MP CEF.".to_string()),
            error: None,
        }
    } else {
        UninstallResult {
            success: true,
            message: Some("Open.MP CEF was not found in this directory.".to_string()),
            error: None,
        }
    }
}

// ─── App Entry ───────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_remote_version,
            check_installation,
            install_cef,
            uninstall_cef,
            select_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
