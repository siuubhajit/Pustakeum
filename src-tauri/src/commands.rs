use std::fs;
use std::path::Path;
use tauri::State;

use crate::database::queries::{self, AnnotationView, BookMetadataUpdate, BookView, LibraryStats};
use crate::engine::{self, DocumentOverview};
use crate::search;
use crate::{AppState, OpenBookResponse};

#[tauri::command]
pub fn get_library_books(state: State<AppState>) -> Result<Vec<BookView>, String> {
    let conn = state.db.lock_conn();
    queries::get_all_books(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_books(query: String, state: State<AppState>) -> Result<Vec<BookView>, String> {
    let conn = state.db.lock_conn();
    if query.trim().is_empty() {
        queries::get_all_books(&conn).map_err(|e| e.to_string())
    } else {
        queries::search_books_fts(&conn, &query).map_err(|e| e.to_string())
    }
}

/// Native file picker dialog returning picked file paths
#[tauri::command]
pub fn pick_files_dialog() -> Vec<String> {
    let files = rfd::FileDialog::new()
        .add_filter("Supported Documents", &["epub", "pdf", "cbz", "cbr", "txt"])
        .add_filter("EPUB Books (*.epub)", &["epub"])
        .add_filter("PDF Documents (*.pdf)", &["pdf"])
        .add_filter("Comic Books (*.cbz, *.cbr)", &["cbz", "cbr"])
        .add_filter("Plain Text (*.txt)", &["txt"])
        .pick_files();

    match files {
        Some(paths) => paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect(),
        None => Vec::new(),
    }
}

/// Native directory picker dialog returning picked folder path
#[tauri::command]
pub fn pick_directory_dialog() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_book_file(file_path: String, state: State<AppState>) -> Result<BookView, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let file_bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let hash = blake3::hash(&file_bytes).to_hex().to_string();
    let file_size = file_bytes.len() as i64;

    // Check if already in database
    {
        let conn = state.db.lock_conn();
        let mut check_stmt = conn
            .prepare("SELECT id FROM books WHERE blake3_hash = ?")
            .map_err(|e| e.to_string())?;
        let existing_id: rusqlite::Result<i64> = check_stmt.query_row([&hash], |r| r.get(0));
        if let Ok(id) = existing_id {
            let books = queries::get_all_books(&conn).map_err(|e| e.to_string())?;
            if let Some(b) = books.into_iter().find(|b| b.id == id) {
                return Ok(b);
            }
        }
    }

    let overview: DocumentOverview = engine::inspect_file(path)?;
    let book_uuid = uuid::Uuid::new_v4().to_string();

    let title = if overview.title.is_empty() {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    } else {
        overview.title
    };

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("TXT")
        .to_uppercase();

    // Store cover if extracted
    let mut cover_path_opt = None;
    if let Some(ref cover_b64) = overview.cover_image_data {
        if let Some(comma_pos) = cover_b64.find(',') {
            let b64_data = &cover_b64[comma_pos + 1..];
            let covers_dir = state.storage_dir.join("covers");
            let _ = fs::create_dir_all(&covers_dir);
            let cover_filename = format!("{}.jpg", book_uuid);
            let cover_file_path = covers_dir.join(&cover_filename);
            cover_path_opt = Some(cover_b64.clone());
            let _ = fs::write(&cover_file_path, b64_data);
        }
    }

    let conn = state.db.lock_conn();
    let new_id = queries::insert_book(
        &conn,
        &book_uuid,
        &hash,
        &title,
        &file_path,
        file_size,
        &ext,
        overview.page_count,
        &overview.authors,
        None,
        None,
        &vec![ext.clone()],
        None,
        None,
        overview.description.as_deref(),
        None,
        cover_path_opt.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    let books = queries::get_all_books(&conn).map_err(|e| e.to_string())?;
    books
        .into_iter()
        .find(|b| b.id == new_id)
        .ok_or_else(|| "Failed to retrieve inserted book".to_string())
}

/// Recursively scans a directory and imports all supported documents in bulk
#[tauri::command]
pub fn import_directory_recursive(
    dir_path: String,
    state: State<AppState>,
) -> Result<Vec<BookView>, String> {
    let root = Path::new(&dir_path);
    if !root.is_dir() {
        return Err(format!("Not a valid directory: {}", dir_path));
    }

    let mut imported = Vec::new();
    let supported_exts = ["epub", "pdf", "cbz", "cbr", "txt"];

    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let p = entry.path();
        if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
            if supported_exts.contains(&ext.to_lowercase().as_str()) {
                if let Ok(book) = import_book_file(p.to_string_lossy().to_string(), state.clone()) {
                    imported.push(book);
                }
            }
        }
    }

    Ok(imported)
}

/// Native OS Reveal in Explorer / Finder
#[tauri::command]
pub fn reveal_in_explorer(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist on disk".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn update_book_metadata(
    update: BookMetadataUpdate,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock_conn();
    queries::update_book_metadata(&conn, &update).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_book(book_id: i64, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock_conn();
    queries::delete_book(&conn, book_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library_stats(state: State<AppState>) -> Result<LibraryStats, String> {
    let conn = state.db.lock_conn();
    queries::get_library_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_book_content(
    book_id: i64,
    state: State<AppState>,
) -> Result<OpenBookResponse, String> {
    let conn = state.db.lock_conn();
    let books = queries::get_all_books(&conn).map_err(|e| e.to_string())?;
    let book = books
        .into_iter()
        .find(|b| b.id == book_id)
        .ok_or_else(|| "Book not found".to_string())?;

    let path = Path::new(&book.file_path);
    if !path.exists() {
        return Err(format!("Book file no longer exists at: {}", book.file_path));
    }

    let mut epub_data = None;
    let mut comic_data = None;
    let mut pdf_data = None;

    match book.file_format.as_str() {
        "EPUB" => {
            if let Ok(epub) = engine::epub::parse_epub(path) {
                epub_data = Some(epub);
            }
        }
        "CBZ" => {
            if let Ok(comic) = engine::comics::inspect_cbz(path) {
                comic_data = Some(comic);
            }
        }
        "PDF" => {
            if let Ok(pdf) = engine::pdf::inspect_pdf(path) {
                pdf_data = Some(pdf);
            }
        }
        _ => {}
    }

    Ok(OpenBookResponse {
        book,
        epub_data,
        comic_data,
        pdf_data,
    })
}

#[tauri::command]
pub fn get_cbz_page(
    file_path: String,
    page_index: usize,
) -> Result<String, String> {
    let bytes = engine::comics::extract_cbz_page(&file_path, page_index)?;
    let b64 = format!("data:image/jpeg;base64,{}", engine::epub::EpubBook::base64_encode_bytes(&bytes));
    Ok(b64)
}

#[tauri::command]
pub fn update_reading_progress(
    book_id: i64,
    current_page: i32,
    current_cfi: Option<String>,
    progress_percentage: f64,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock_conn();
    queries::update_reading_progress(
        &conn,
        book_id,
        current_page,
        current_cfi.as_deref(),
        progress_percentage,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_in_book(
    book_id: i64,
    query: String,
    state: State<AppState>,
) -> Result<Vec<search::indexer::SearchMatch>, String> {
    let conn = state.db.lock_conn();
    let books = queries::get_all_books(&conn).map_err(|e| e.to_string())?;
    let book = books
        .into_iter()
        .find(|b| b.id == book_id)
        .ok_or_else(|| "Book not found".to_string())?;

    let path = Path::new(&book.file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let mut sections = Vec::new();
    if book.file_format == "EPUB" {
        if let Ok(epub) = engine::epub::parse_epub(path) {
            for (idx, chapter) in epub.chapters.into_iter().enumerate() {
                sections.push((idx, chapter.title, chapter.content));
            }
        }
    } else if book.file_format == "TXT" {
        if let Ok(txt) = fs::read_to_string(path) {
            sections.push((0, "Document".to_string(), txt));
        }
    }

    let matches = search::indexer::search_in_text(&sections, &query, 50);
    Ok(matches)
}

// --- Industrial-Grade Annotation Commands ---

#[tauri::command]
pub fn create_annotation(
    book_id: i64,
    annotation_type: String,
    page_index: Option<i32>,
    selected_text: Option<String>,
    note_comment: Option<String>,
    color_hex: String,
    state: State<AppState>,
) -> Result<AnnotationView, String> {
    let conn = state.db.lock_conn();
    queries::insert_annotation(
        &conn,
        book_id,
        &annotation_type,
        page_index,
        selected_text.as_deref(),
        note_comment.as_deref(),
        &color_hex,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_book_annotations(
    book_id: i64,
    state: State<AppState>,
) -> Result<Vec<AnnotationView>, String> {
    let conn = state.db.lock_conn();
    queries::get_annotations_for_book(&conn, book_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_annotation(
    annotation_id: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock_conn();
    queries::delete_annotation(&conn, annotation_id).map_err(|e| e.to_string())
}

// --- Format Conversion Command ---

#[tauri::command]
pub fn convert_book_format(
    book_id: i64,
    target_format: String,
    state: State<AppState>,
) -> Result<String, String> {
    let book = {
        let conn = state.db.lock_conn();
        let books = queries::get_all_books(&conn).map_err(|e| e.to_string())?;
        books
            .into_iter()
            .find(|b| b.id == book_id)
            .ok_or_else(|| "Book not found".to_string())?
    };

    let source_path = Path::new(&book.file_path);
    if !source_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    let output_folder = rfd::FileDialog::new()
        .set_title("Choose Output Directory for Converted Document")
        .pick_folder();

    let dest_dir = match output_folder {
        Some(d) => d,
        None => return Err("Conversion cancelled by user".to_string()),
    };

    let out_ext = match target_format.to_lowercase().as_str() {
        "markdown" | "md" => "md",
        "html" => "html",
        "txt" => "txt",
        _ => return Err(format!("Unsupported target format: {}", target_format)),
    };

    let file_stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("converted");

    let target_filename = format!("{}_converted.{}", file_stem, out_ext);
    let target_path = dest_dir.join(&target_filename);

    crate::converter::convert_book_document(source_path, &target_format, &target_path)?;

    Ok(target_path.to_string_lossy().to_string())
}

// --- Library Backup & Catalog Export ---

#[tauri::command]
pub fn export_library_catalog(
    format: String,
    state: State<AppState>,
) -> Result<String, String> {
    let conn = state.db.lock_conn();

    let is_csv = format.to_lowercase() == "csv";
    let (filter_name, ext) = if is_csv {
        ("CSV Spreadsheet (*.csv)", "csv")
    } else {
        ("JSON Document (*.json)", "json")
    };

    let save_dialog = rfd::FileDialog::new()
        .set_file_name(&format!("pustakeum_library_backup.{}", ext))
        .add_filter(filter_name, &[ext])
        .save_file();

    let target_path = match save_dialog {
        Some(p) => p,
        None => return Err("Export cancelled by user".to_string()),
    };

    let content = if is_csv {
        queries::export_catalog_as_csv(&conn).map_err(|e| e.to_string())?
    } else {
        queries::export_catalog_as_json(&conn).map_err(|e| e.to_string())?
    };

    fs::write(&target_path, content).map_err(|e| format!("Failed to save export: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}
