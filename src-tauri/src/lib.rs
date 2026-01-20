use std::fs;
use std::path::PathBuf;

/// Get the config directory path for storing app settings
fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("illien");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

/// App settings structure
#[derive(serde::Serialize, serde::Deserialize, Default)]
struct Settings {
    journal_directory: Option<String>,
    dark_mode: Option<bool>,
}

fn load_settings() -> Settings {
    let config_path = get_config_path();
    if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        Settings::default()
    }
}

fn save_settings(settings: &Settings) -> Result<(), String> {
    let config_path = get_config_path();
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

/// Save a journal entry to a file
#[tauri::command]
fn save_journal(date: String, content: String, directory: String) -> Result<(), String> {
    let path = PathBuf::from(&directory).join(format!("{}.md", date));
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save journal entry: {}", e))
}

/// Load a journal entry from a file
#[tauri::command]
fn load_journal(date: String, directory: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&directory).join(format!("{}.md", date));
    if path.exists() {
        fs::read_to_string(&path)
            .map(Some)
            .map_err(|e| format!("Failed to load journal entry: {}", e))
    } else {
        Ok(None)
    }
}

/// List all journal entries in the directory
#[tauri::command]
fn list_journal_entries(directory: String) -> Result<Vec<String>, String> {
    let dir_path = PathBuf::from(&directory);
    let mut entries: Vec<String> = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            // Match files like "2026-01-20.md"
            if file_name.len() == 13
                && file_name.ends_with(".md")
                && file_name.chars().nth(4) == Some('-')
                && file_name.chars().nth(7) == Some('-')
            {
                Some(file_name[..10].to_string())
            } else {
                None
            }
        })
        .collect();

    // Sort by date descending (newest first)
    entries.sort_by(|a, b| b.cmp(a));
    Ok(entries)
}

/// Get the saved journal directory
#[tauri::command]
fn get_journal_directory() -> Option<String> {
    load_settings().journal_directory
}

/// Save the journal directory setting
#[tauri::command]
fn set_journal_directory(directory: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.journal_directory = Some(directory);
    save_settings(&settings)
}

/// Get the dark mode preference
#[tauri::command]
fn get_dark_mode() -> Option<bool> {
    load_settings().dark_mode
}

/// Save the dark mode preference
#[tauri::command]
fn set_dark_mode(dark_mode: bool) -> Result<(), String> {
    let mut settings = load_settings();
    settings.dark_mode = Some(dark_mode);
    save_settings(&settings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_journal,
            load_journal,
            list_journal_entries,
            get_journal_directory,
            set_journal_directory,
            get_dark_mode,
            set_dark_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
