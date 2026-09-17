use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfMetadata {
    pub title: String,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub page_count: i32,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfOutlineItem {
    pub title: String,
    pub page_number: u32,
}

pub fn inspect_pdf<P: AsRef<Path>>(path: P) -> Result<PdfMetadata, String> {
    let doc = Document::load(path.as_ref()).map_err(|e| format!("Failed to parse PDF: {}", e))?;
    let page_count = doc.get_pages().len() as i32;

    let title = path
        .as_ref()
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled Document")
        .to_string();

    Ok(PdfMetadata {
        title,
        author: None,
        subject: None,
        page_count,
        version: doc.version.clone(),
    })
}

pub fn extract_pdf_page_text<P: AsRef<Path>>(path: P, page_number: u32) -> Result<String, String> {
    let doc = Document::load(path.as_ref()).map_err(|e| format!("Failed to parse PDF: {}", e))?;
    let text = doc
        .extract_text(&[page_number])
        .map_err(|e| format!("Failed to extract text from page {}: {}", page_number, e))?;
    Ok(text)
}

