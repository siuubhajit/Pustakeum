pub mod comics;
pub mod epub;
pub mod memory_ring;
pub mod pdf;

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentOverview {
    pub title: String,
    pub format: String,
    pub page_count: i32,
    pub authors: Vec<String>,
    pub cover_image_data: Option<String>,
    pub description: Option<String>,
}

pub fn inspect_file<P: AsRef<Path>>(path: P) -> Result<DocumentOverview, String> {
    let p = path.as_ref();
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_uppercase();

    match ext.as_str() {
        "EPUB" => {
            let book = epub::parse_epub(p)?;
            Ok(DocumentOverview {
                title: book.metadata.title,
                format: "EPUB".to_string(),
                page_count: book.chapters.len() as i32,
                authors: book.metadata.creators,
                cover_image_data: book.metadata.cover_image_data,
                description: book.metadata.description,
            })
        }
        "PDF" => {
            let meta = pdf::inspect_pdf(p)?;
            Ok(DocumentOverview {
                title: meta.title,
                format: "PDF".to_string(),
                page_count: meta.page_count,
                authors: meta.author.into_iter().collect(),
                cover_image_data: None,
                description: meta.subject,
            })
        }
        "CBZ" => {
            let comic = comics::inspect_cbz(p)?;
            Ok(DocumentOverview {
                title: comic.title,
                format: "CBZ".to_string(),
                page_count: comic.page_count as i32,
                authors: Vec::new(),
                cover_image_data: None,
                description: None,
            })
        }
        "TXT" => {
            let title = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Text Document").to_string();
            Ok(DocumentOverview {
                title,
                format: "TXT".to_string(),
                page_count: 1,
                authors: Vec::new(),
                cover_image_data: None,
                description: None,
            })
        }
        _ => Err(format!("Unsupported file format: .{}", ext)),
    }
}

