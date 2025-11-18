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

#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::env;

// Windows-specific: Find installation directory from registry
#[cfg(target_os = "windows")]
fn find_install_dir(display_name_part: &str) -> Option<String> {
    let display_name_part = display_name_part.to_lowercase();
    let uninstall_keys = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (root_key, subkey_path) in &uninstall_keys {
        if let Ok(key) = RegKey::predef(*root_key).open_subkey(subkey_path) {
            for i in 0.. {
                match key.enum_keys().nth(i as usize) {
                    Some(Ok(subkey_name)) => {
                        if let Ok(subkey) = key.open_subkey(&subkey_name) {
                            // Get DisplayName
                            if let Ok(name) = subkey.get_value::<String, &str>("DisplayName") {
                                if name.to_lowercase().contains(&display_name_part) {
                                    // Try InstallLocation first
                                    if let Ok(install_loc) = subkey.get_value::<String, &str>("InstallLocation") {
                                        if !install_loc.is_empty() && Path::new(&install_loc).exists() {
                                            return Some(install_loc);
                                        }
                                    }
                                    
                                    // Fallback: use UninstallString and strip exe
                                    if let Ok(uninstall_str) = subkey.get_value::<String, &str>("UninstallString") {
                                        let path = uninstall_str.trim_matches('"');
                                        if let Some(dir_path) = Path::new(path).parent() {
                                            let dir_str = dir_path.to_string_lossy().to_string();
                                            if Path::new(&dir_str).exists() {
                                                return Some(dir_str);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(_)) => continue,
                    None => break,
                }
            }
        }
    }
    None
}

// Windows-specific: Add directory to user PATH
#[cfg(target_os = "windows")]
fn persist_add_to_user_path(dir_path: &str) -> Result<(bool, String), String> {
    if !Path::new(dir_path).exists() {
        return Ok((false, "Invalid directory path".to_string()));
    }

    let key_path = r"Environment";
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    let key = hkcu.open_subkey_with_flags(key_path, KEY_READ | KEY_SET_VALUE)
        .map_err(|e| format!("Failed to open Environment key: {}", e))?;
    
    let current: String = match key.get_value("Path") {
        Ok(path) => path,
        Err(_) => String::new(),
    };
    
    let paths: Vec<&str> = if current.is_empty() {
        Vec::new()
    } else {
        current.split(';').collect()
    };
    
    if paths.contains(&dir_path) {
        return Ok((true, "Already in user PATH".to_string()));
    }
    
    let new_value = if current.is_empty() {
        dir_path.to_string()
    } else {
        format!("{};{}", dir_path, current)
    };
    
    key.set_value("Path", &new_value)
        .map_err(|e| format!("Failed to set PATH: {}", e))?;

    Ok((false, "Added to user PATH".to_string()))
}

// Tauri command to detect archive tool (7-Zip or WinRAR) - Pure Rust implementation
#[tauri::command]
async fn detect_archive_tool() -> Result<serde_json::Value, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(serde_json::json!({
            "success": false,
            "message": "Archive tool detection is only supported on Windows",
            "already_in_path": false
        }));
    }
    
    #[cfg(target_os = "windows")]
    {
        // Try WinRAR first (preferred)
        if let Some(winrar_dir) = find_install_dir("winrar") {
            let rar_exe = Path::new(&winrar_dir).join("rar.exe");
            let winrar_exe = Path::new(&winrar_dir).join("WinRAR.exe");
            
            let executable = if rar_exe.exists() {
                rar_exe.to_string_lossy().to_string()
            } else if winrar_exe.exists() {
                winrar_exe.to_string_lossy().to_string()
            } else {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "WinRAR installation found but executables not detected",
                    "already_in_path": false
                }));
            };
            
            match persist_add_to_user_path(&winrar_dir) {
                Ok((already_in_path, _message)) => {
                    let path_status = if already_in_path {
                        "already in user PATH".to_string()
                    } else {
                        "added to user PATH (persistent)".to_string()
                    };
                    
                    return Ok(serde_json::json!({
                        "success": true,
                        "name": "WinRAR",
                        "path": winrar_dir,
                        "executable": executable,
                        "already_in_path": already_in_path,
                        "path_status": path_status,
                        "message": format!("WinRAR detected at {} and {}", winrar_dir, path_status)
                    }));
                }
                Err(e) => {
                    return Ok(serde_json::json!({
                        "success": false,
                        "message": format!("WinRAR found but PATH update failed: {}", e),
                        "already_in_path": false
                    }));
                }
            }
        }
        
        // Try 7-Zip as fallback
        if let Some(sevenzip_dir) = find_install_dir("7-zip") {
            let sevenzip_exe = Path::new(&sevenzip_dir).join("7z.exe");
            
            if sevenzip_exe.exists() {
                match persist_add_to_user_path(&sevenzip_dir) {
                    Ok((already_in_path, _message)) => {
                        let path_status = if already_in_path {
                            "already in user PATH".to_string()
                        } else {
                            "added to user PATH (persistent)".to_string()
                        };
                        
                        return Ok(serde_json::json!({
                            "success": true,
                            "name": "7-Zip",
                            "path": sevenzip_dir,
                            "executable": sevenzip_exe.to_string_lossy().to_string(),
                            "already_in_path": already_in_path,
                            "path_status": path_status,
                            "message": format!("7-Zip detected at {} and {}", sevenzip_dir, path_status)
                        }));
                    }
                    Err(e) => {
                        return Ok(serde_json::json!({
                            "success": false,
                            "message": format!("7-Zip found but PATH update failed: {}", e),
                            "already_in_path": false
                        }));
                    }
                }
            } else {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "7-Zip installation found but 7z.exe not detected",
                    "already_in_path": false
                }));
            }
        }
        
        // Not found
        Ok(serde_json::json!({
            "success": false,
            "message": "Neither 7-Zip nor WinRAR installation found",
            "already_in_path": false
        }))
    }
}

// Tauri command to get archive tool information for Python backend
#[tauri::command]
fn get_archive_tool_info() -> Result<serde_json::Value, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(serde_json::json!({
            "success": false,
            "message": "Archive tool detection is only supported on Windows",
            "rar_tool_path": None::<String>
        }));
    }
    
    #[cfg(target_os = "windows")]
    {
        // Reuse the same logic as detect_archive_tool but return the executable path
        if let Some(winrar_dir) = find_install_dir("winrar") {
            let rar_exe = Path::new(&winrar_dir).join("rar.exe");
            let winrar_exe = Path::new(&winrar_dir).join("WinRAR.exe");
            
            let executable = if rar_exe.exists() {
                rar_exe.to_string_lossy().to_string()
            } else if winrar_exe.exists() {
                winrar_exe.to_string_lossy().to_string()
            } else {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "WinRAR installation found but executables not detected",
                    "rar_tool_path": None::<String>
                }));
            };
            
            // Try to add to PATH if not already there (don't fail if it can't)
            let _ = persist_add_to_user_path(&winrar_dir);
            
            return Ok(serde_json::json!({
                "success": true,
                "name": "WinRAR",
                "path": winrar_dir,
                "executable": executable,
                "rar_tool_path": executable,
                "message": format!("WinRAR found at: {}", executable)
            }));
        }
        
        // Try 7-Zip as fallback
        if let Some(sevenzip_dir) = find_install_dir("7-zip") {
            let sevenzip_exe = Path::new(&sevenzip_dir).join("7z.exe");
            
            if sevenzip_exe.exists() {
                // Try to add to PATH if not already there (don't fail if it can't)
                let _ = persist_add_to_user_path(&sevenzip_dir);
                
                return Ok(serde_json::json!({
                    "success": true,
                    "name": "7-Zip",
                    "path": sevenzip_dir,
                    "executable": sevenzip_exe.to_string_lossy().to_string(),
                    "rar_tool_path": sevenzip_exe.to_string_lossy().to_string(),
                    "message": format!("7-Zip found at: {}", sevenzip_exe.to_string_lossy())
                }));
            } else {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "7-Zip installation found but 7z.exe not detected",
                    "rar_tool_path": None::<String>
                }));
            }
        }
        
        // Not found
        Ok(serde_json::json!({
            "success": false,
            "message": "Neither 7-Zip nor WinRAR installation found",
            "rar_tool_path": None::<String>
        }))
    }
}
// Tauri command to get sidecar paths
#[tauri::command]
fn get_sidecar_path(sidecar_name: String) -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Failed to get executable directory".to_string())?;
    
    // Look in the sidecars subdirectory as per tauri.conf.json
    let sidecars_dir = exe_dir.join("sidecars");
    
    match sidecar_name.as_str() {
        "repak" => {
            // Try multiple possible names for the repak executable
            let names = ["repak.exe", "repak-x86_64-pc-windows-msvc.exe", "repak.exe.exe"];
            for name in &names {
                let path = sidecars_dir.join(name);
                if path.exists() {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
            return Err("repak executable not found".to_string());
        }
        "retoc_cli" => {
            // Try multiple possible names for the retoc_cli executable
            let names = ["retoc_cli.exe", "retoc_cli-x86_64-pc-windows-msvc.exe", "retoc_cli.exe.exe"];
            for name in &names {
                let path = sidecars_dir.join(name);
                if path.exists() {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
            return Err("retoc_cli executable not found".to_string());
        }
        _ => return Err(format!("Unknown sidecar: {}", sidecar_name)),
    };
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
        
        // Detect archive tools and set environment variables for Python backend
        #[cfg(target_os = "windows")]
        {
            // Try to get archive tool info
            match get_archive_tool_info() {
                Ok(archive_info) => {
                    if let Some(rar_tool_path) = archive_info.get("rar_tool_path").and_then(|v| v.as_str()) {
                        std::env::set_var("RAR_TOOL_PATH", rar_tool_path);
                        println!("[Archive Tool] Set RAR_TOOL_PATH={}", rar_tool_path);
                    }
                }
                Err(e) => {
                    println!("[Archive Tool] Failed to detect archive tools: {}", e);
                }
            }
        }
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
            select_file_dialog,
            detect_archive_tool,
            get_archive_tool_info,
            get_sidecar_path
        ])
        .invoke_handler(tauri::generate_handler![
            get_executable_path,
            handle_nxm_url,
            select_folder_dialog,
            select_file_dialog,
            detect_archive_tool,
            get_sidecar_path
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
