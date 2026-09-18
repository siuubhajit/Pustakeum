use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComicManifest {
    pub title: String,
    pub page_count: usize,
    pub page_names: Vec<String>,
}

pub fn inspect_cbz<P: AsRef<Path>>(path: P) -> Result<ComicManifest, String> {
    let file = File::open(path.as_ref()).map_err(|e| format!("Failed to open CBZ: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid zip: {}", e))?;

    let mut image_entries = Vec::new();

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            let lower = name.to_lowercase();
            if lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".png")
                || lower.ends_with(".webp")
            {
                image_entries.push(name);
            }
        }
    }

    image_entries.sort();

    let title = path
        .as_ref()
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Comic Book")
        .to_string();

    Ok(ComicManifest {
        title,
        page_count: image_entries.len(),
        page_names: image_entries,
    })
}

pub fn extract_cbz_page<P: AsRef<Path>>(path: P, page_index: usize) -> Result<Vec<u8>, String> {
    let file = File::open(path.as_ref()).map_err(|e| format!("Failed to open CBZ: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid zip: {}", e))?;

    let mut image_entries = Vec::new();
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            let lower = name.to_lowercase();
            if lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".png")
                || lower.ends_with(".webp")
            {
                image_entries.push(name);
            }
        }
    }
    image_entries.sort();

    if page_index >= image_entries.len() {
        return Err("Page index out of bounds".to_string());
    }

    let target_name = &image_entries[page_index];
    let mut zip_file = archive
        .by_name(target_name)
        .map_err(|e| format!("Page not found in archive: {}", e))?;

    let mut bytes = Vec::new();
    zip_file
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read page data: {}", e))?;

    Ok(bytes)
}
