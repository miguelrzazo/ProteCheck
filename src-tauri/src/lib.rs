use serde::Serialize;
use std::fs;

#[derive(Serialize)]
struct FileInfo {
    name: String,
    path: String,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "xls" || ext == "xlsx" {
                        files.push(FileInfo {
                            name: entry.file_name().to_string_lossy().into_owned(),
                            path: path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    let data = fs::read(path).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(data))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_dir, read_file_base64])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
