#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::sync::{Arc, Mutex};

use rfd::AsyncFileDialog;
use tauri::{AppHandle, Manager};
#[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
use tauri_plugin_shell::process::CommandEvent;
#[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
use tauri_plugin_shell::ShellExt;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[derive(Clone, Default)]
struct BackendChild(Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>);

impl BackendChild {
    fn new() -> Self {
        Self::default()
    }

    fn set(&self, child: tauri_plugin_shell::process::CommandChild) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some(child);
        }
    }
}

// Tauri command to open folder selection dialog
#[tauri::command]
async fn select_folder_dialog(default_path: Option<String>) -> Result<String, String> {
    println!("[Dialog] Requested folder selection with default path: {:?}", default_path);
    
    match AsyncFileDialog::new()
        .set_title("Select Folder")
        .pick_folder()
        .await
    {
        Some(path) => {
            let path_string = path.path().to_string_lossy().to_string();
            println!("[Dialog] Selected folder: {}", path_string);
            Ok(path_string)
        }
        None => {
            println!("[Dialog] Folder selection cancelled");
            Err("Selection cancelled".to_string())
        }
    }
}

// Tauri command to open file selection dialog
#[tauri::command]
async fn select_file_dialog(default_path: Option<String>, filter_extensions: Option<Vec<String>>) -> Result<String, String> {
    println!("[Dialog] Requested file selection with default path: {:?}, extensions: {:?}", default_path, filter_extensions);
    
    let mut dialog = AsyncFileDialog::new()
        .set_title("Select File");
    
    // Add filters if provided
    if let Some(extensions) = filter_extensions {
        for ext in extensions {
            dialog = dialog.add_filter("Files", &[&ext]);
        }
    }
    
    match dialog.pick_file().await {
        Some(file) => {
            let path_string = file.path().to_string_lossy().to_string();
            println!("[Dialog] Selected file: {}", path_string);
            Ok(path_string)
        }
        None => {
            println!("[Dialog] File selection cancelled");
            Err("Selection cancelled".to_string())
        }
    }
}

// Tauri command to get the current executable path
#[tauri::command]
fn get_executable_path() -> Result<String, String> {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get executable path: {}", e))
}

// Windows-specific: Ensure NXM protocol is registered with proper quoting
// This fixes the issue where ampersands in URLs get split by Windows shell
#[cfg(target_os = "windows")]
fn ensure_nxm_protocol_registration() -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_str = exe_path.to_string_lossy().to_string();
    
    // The critical fix: Use proper quoting so the full URL is passed as ONE argument
    // Format: "C:\Path\To\App.exe" "%1"
    // The "%1" in quotes ensures ampersands and other special chars are preserved
    let command_value = format!("\"{}\" \"%1\"", exe_str);
    
    println!("[NXM Protocol] Registering with command: {}", command_value);
    
    // Register under HKEY_CURRENT_USER (per-user, no admin needed)
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Create/open: HKCU\Software\Classes\nxm
    let (nxm_key, _) = hkcu
        .create_subkey(r"Software\Classes\nxm")
        .map_err(|e| format!("Failed to create nxm key: {}", e))?;
    
    // Set default value: "URL:nxm"
    nxm_key
        .set_value("", &"URL:nxm")
        .map_err(|e| format!("Failed to set nxm description: {}", e))?;
    
    // Set URL Protocol marker (empty string value)
    nxm_key
        .set_value("URL Protocol", &"")
        .map_err(|e| format!("Failed to set URL Protocol: {}", e))?;
    
    // Create: HKCU\Software\Classes\nxm\shell\open\command
    let (command_key, _) = hkcu
        .create_subkey(r"Software\Classes\nxm\shell\open\command")
        .map_err(|e| format!("Failed to create command key: {}", e))?;
    
    // Set default value with PROPER QUOTING: "C:\Path\To\App.exe" "%1"
    command_key
        .set_value("", &command_value)
        .map_err(|e| format!("Failed to set command value: {}", e))?;
    
    println!("[NXM Protocol] Successfully registered nxm:// protocol");
    println!("[NXM Protocol] Executable: {}", exe_str);
    println!("[NXM Protocol] Command registered: {}", command_value);
    
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn ensure_nxm_protocol_registration() -> Result<(), String> {
    // Non-Windows platforms use Tauri's built-in deep-link plugin
    println!("[NXM Protocol] Using Tauri deep-link plugin (non-Windows)");
    Ok(())
}

// Tauri command to handle NXM protocol URLs
#[tauri::command]
async fn handle_nxm_url(url: String, _app_handle: AppHandle) -> Result<String, String> {
    println!("Received NXM URL: {}", url);
    
    // Forward the NXM URL to the backend API
    let client = reqwest::Client::new();
    let backend_url = "http://127.0.0.1:8000/api/nxm/handoff";
    
    let payload = serde_json::json!({
        "nxm": url
    });
    
    match client.post(backend_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(format!("NXM URL forwarded to backend: {}", url))
            } else {
                Err(format!("Backend returned error: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Failed to contact backend: {}", e))
    }
}

async fn launch_backend(app_handle: AppHandle, backend_state: BackendChild) -> Result<(), String> {
    #[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
    {
        // Set environment variable so Python backend can find the Tauri executable
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        std::env::set_var("TAURI_APP_PATH", exe_path.to_string_lossy().to_string());
        
        // In debug mode, use Python directly for live code updates
        // In release mode, use the compiled sidecar
        let use_python_direct = cfg!(debug_assertions);
        
        if use_python_direct {
            println!("[DEV MODE] Running backend from Python source for live updates");
            
            // Find Python executable
            let python_cmd = if cfg!(target_os = "windows") {
                "python"
            } else {
                "python3"
            };
            
            // Get the workspace root (parent of src-tauri directory)
            let exe_path = std::env::current_exe().map_err(|e| format!("Failed to get exe path: {e}"))?;
            let mut current = exe_path.parent();
            
            // Navigate up until we find src-tauri directory, then go one more level up
            let workspace_root = loop {
                match current {
                    Some(dir) => {
                        if dir.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
                            break dir.parent().ok_or("No workspace root")?;
                        }
                        current = dir.parent();
                    }
                    None => return Err("Could not find workspace root".to_string()),
                }
            };
            
            let python_script = workspace_root.join("src-python").join("run_server.py");
            
            println!("[DEV] Workspace root: {}", workspace_root.display());
            println!("[DEV] Looking for Python script at: {}", python_script.display());
            
            if !python_script.exists() {
                eprintln!("Python script not found at: {}", python_script.display());
                eprintln!("Falling back to sidecar...");
                // Fall through to sidecar logic below
            } else {
                match app_handle.shell().command(python_cmd)
                    .args(["-X", "utf8", python_script.to_str().unwrap()])
                    .env("MM_BACKEND_HOST", "127.0.0.1")
                    .env("MM_BACKEND_PORT", "8000")
                    .env("PYTHONPATH", workspace_root.to_str().unwrap())
                    .envs(if let Ok(data_dir) = app_handle.path().app_data_dir() {
                        println!("Using MODMANAGER_DATA_DIR at {}", data_dir.display());
                        if let Err(err) = fs::create_dir_all(&data_dir) {
                            eprintln!("Failed to create app data directory: {err}");
                        }
                        if let Some(path_str) = data_dir.to_str() {
                            std::env::set_var("MODMANAGER_DATA_DIR", path_str);
                            vec![("MODMANAGER_DATA_DIR".to_string(), path_str.to_string())]
                        } else {
                            vec![]
                        }
                    } else {
                        vec![]
                    })
                    .spawn()
                {
                    Ok((mut receiver, child)) => {
                        backend_state.set(child);
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = receiver.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        println!("[backend] {text}");
                                    }
                                    CommandEvent::Stderr(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        eprintln!("[backend] {text}");
                                    }
                                    CommandEvent::Error(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        eprintln!("[backend error] {text}");
                                    }
                                    _ => {}
                                }
                            }
                        });
                        return Ok(());
                    }
                    Err(err) => {
                        eprintln!("Failed to spawn Python backend: {err}");
                        eprintln!("Falling back to sidecar...");
                        // Fall through to sidecar logic below
                    }
                }
            }
        }
        
        // Production mode or fallback: use compiled sidecar
        println!("[PRODUCTION MODE] Using compiled sidecar");
    match app_handle.shell().sidecar("rivalnxt_backend") {
            Ok(command) => {
                let mut command = command
                    .env("MM_BACKEND_HOST", "127.0.0.1")
                    .env("MM_BACKEND_PORT", "8000");

                if let Ok(data_dir) = app_handle.path().app_data_dir() {
                    println!("[PRODUCTION] App data directory: {}", data_dir.display());
                    if let Err(err) = fs::create_dir_all(&data_dir) {
                        eprintln!("[PRODUCTION] Failed to create app data directory: {err}");
                    } else {
                        println!("[PRODUCTION] Successfully created/verified app data directory");
                    }
                    if let Some(path_str) = data_dir.to_str() {
                        println!("[PRODUCTION] Setting MODMANAGER_DATA_DIR={}", path_str);
                        command = command.env("MODMANAGER_DATA_DIR", path_str);
                        // Also set it as a process-wide environment variable for any child processes
                        std::env::set_var("MODMANAGER_DATA_DIR", path_str);
                    } else {
                        eprintln!("[PRODUCTION] Failed to convert data_dir path to string");
                    }
                } else {
                    eprintln!("[PRODUCTION] Failed to get app_data_dir from Tauri");
                }

                match command.spawn() {
                    Ok((mut receiver, child)) => {
                        backend_state.set(child);
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = receiver.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        println!("[backend] {text}");
                                    }
                                    CommandEvent::Stderr(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        eprintln!("[backend] {text}");
                                    }
                                    CommandEvent::Error(line) => {
                                        let bytes: Vec<u8> = line.into();
                                        let text = String::from_utf8_lossy(&bytes);
                                        eprintln!("[backend error] {text}");
                                    }
                                    _ => {}
                                }
                            }
                        });
                    }
                    Err(err) => {
                        eprintln!("Failed to spawn backend sidecar: {err}");
                    }
                }
            }
            Err(err) => {
                eprintln!("Sidecar unavailable: {err}");
            }
        }
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            // This is called when a second instance is launched
            println!("Second instance detected!");
            println!("Args: {:?}", args);
            println!("CWD: {}", cwd);
            
            // Focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
                let _ = window.show();
            }
            
            // Handle nxm:// URLs from the second instance
            for arg in args.iter().skip(1) {  // Skip the executable path
                if arg.starts_with("nxm://") {
                    let url = arg.clone();
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = handle_nxm_url(url.clone(), app_handle).await {
                            eprintln!("Failed to handle NXM URL from second instance: {}", e);
                        }
                    });
                }
            }
        }))
        .manage(BackendChild::new())
        .invoke_handler(tauri::generate_handler![
            get_executable_path,
            handle_nxm_url,
            select_folder_dialog,
            select_file_dialog
        ])
        .setup(|app| {
            // CRITICAL FIX: Register NXM protocol with proper quoting on Windows
            // This ensures the full URL (including &key=...&expires=...) is passed intact
            #[cfg(target_os = "windows")]
            {
                if let Err(e) = ensure_nxm_protocol_registration() {
                    eprintln!("[NXM Protocol] WARNING: Failed to register protocol: {}", e);
                    eprintln!("[NXM Protocol] Deep links may not work correctly!");
                } else {
                    println!("[NXM Protocol] Successfully ensured proper registration with quoting");
                }
            }
            
            // Register deep link handler for nxm:// protocol
            #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
                
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    // Get URLs once (consumes event)
                    let urls = event.urls();
                    
                    // Convert URLs to strings for logging and processing
                    let url_strings: Vec<String> = urls
                        .iter()
                        .map(|u| u.to_string())
                        .collect();
                    
                    println!("Deep link received: {}", url_strings.join(", "));
                    
                    // Handle NXM URLs
                    for url_str in url_strings {
                        if url_str.starts_with("nxm://") {
                            let handle_clone = handle.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = handle_nxm_url(url_str, handle_clone).await {
                                    eprintln!("Failed to handle NXM URL: {}", e);
                                }
                            });
                        }
                    }
                });
            }
            
            let handle = app.handle().clone();
            let backend_state = app.state::<BackendChild>().inner().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = launch_backend(handle, backend_state).await {
                    eprintln!("Failed to start backend: {err}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
