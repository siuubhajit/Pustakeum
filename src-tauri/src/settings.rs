use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub library_view_mode: String,
    pub font_size: i32,
    pub paper_mode: String,
    pub font_family: String,
    pub zoom_level: i32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "bhurjapatra".to_string(),
            library_view_mode: "grid".to_string(),
            font_size: 19,
            paper_mode: "parchment".to_string(),
            font_family: "serif".to_string(),
            zoom_level: 100,
        }
    }
}

pub fn load_settings(storage_dir: &Path) -> AppSettings {
    let settings_file = storage_dir.join("pustakeum_settings.json");
    if settings_file.exists() {
        if let Ok(content) = fs::read_to_string(&settings_file) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    let default_settings = AppSettings::default();
    let _ = save_settings(storage_dir, &default_settings);
    default_settings
}

pub fn save_settings(storage_dir: &Path, settings: &AppSettings) -> Result<(), String> {
    let settings_file = storage_dir.join("pustakeum_settings.json");
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_file, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_settings_persistence() {
        let temp_dir = env::temp_dir().join(format!("pustakeum_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. Initial load should return default and create the file
        let initial = load_settings(&temp_dir);
        assert_eq!(initial.library_view_mode, "grid");

        // 2. Modify and save
        let mut modified = initial.clone();
        modified.library_view_mode = "table".to_string();
        modified.theme = "nila-krshna".to_string();
        save_settings(&temp_dir, &modified).expect("Save should succeed");

        // 3. Reload and verify
        let reloaded = load_settings(&temp_dir);
        assert_eq!(reloaded.library_view_mode, "table");
        assert_eq!(reloaded.theme, "nila-krshna");

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }
}


