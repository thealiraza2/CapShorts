use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

struct BackendProcess(Mutex<Option<Child>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! CapShorts AI engine is ready.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            println!("[tauri] CapShorts Desktop App launching...");

            // Find backend-engine executable next to the app or in resources
            if let Ok(resource_dir) = app.path().resource_dir() {
                let candidate_paths = [
                    resource_dir.join("backend-engine.exe"),
                    resource_dir.join("backend-engine"),
                    resource_dir.join("binaries").join("backend-engine.exe"),
                    resource_dir.join("binaries").join("backend-engine"),
                    resource_dir.join("CapShorts").join("backend-engine.exe"),
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|d| d.join("binaries").join("backend-engine.exe")))
                        .unwrap_or_default(),
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|d| d.join("binaries").join("backend-engine")))
                        .unwrap_or_default(),
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|d| d.join("backend-engine.exe")))
                        .unwrap_or_default(),
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|d| d.join("backend-engine")))
                        .unwrap_or_default(),
                ];

                for engine_path in &candidate_paths {
                    if engine_path.exists() {
                        println!("[tauri] Spawning AI Backend: {:?}", engine_path);
                        
                        #[cfg(target_os = "windows")]
                        {
                            use std::os::windows::process::CommandExt;
                            const CREATE_NO_WINDOW: u32 = 0x08000000;

                            if let Ok(child) = Command::new(engine_path)
                                .creation_flags(CREATE_NO_WINDOW)
                                .spawn()
                            {
                                if let Some(state) = app.try_state::<BackendProcess>() {
                                    *state.0.lock().unwrap() = Some(child);
                                }
                                println!("[tauri] Windows backend daemon running in background.");
                                break;
                            }
                        }

                        #[cfg(not(target_os = "windows"))]
                        {
                            use std::process::Stdio;
                            if let Ok(child) = Command::new(engine_path)
                                .stdout(Stdio::null())
                                .stderr(Stdio::null())
                                .spawn()
                            {
                                if let Some(state) = app.try_state::<BackendProcess>() {
                                    *state.0.lock().unwrap() = Some(child);
                                }
                                println!("[tauri] macOS/Unix backend daemon running in background.");
                                break;
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    // Ensure backend engine and all child processes are killed when window closes
                    if let Some(state) = window.try_state::<BackendProcess>() {
                        if let Ok(mut lock) = state.0.lock() {
                            if let Some(mut child) = lock.take() {
                                #[cfg(target_os = "windows")]
                                {
                                    use std::os::windows::process::CommandExt;
                                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                                    let pid = child.id();
                                    let _ = Command::new("taskkill")
                                        .args(&["/F", "/PID", &pid.to_string(), "/T"])
                                        .creation_flags(CREATE_NO_WINDOW)
                                        .spawn();
                                }
                                let _ = child.kill();
                                println!("[tauri] Background AI Engine terminated.");
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CapShorts application");
}
