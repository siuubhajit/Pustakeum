pub mod comics;
pub mod epub;
pub mod epub_validator;
pub mod memory_ring;
pub mod pdf;
pub mod pdf_annotator;
pub mod webgl;

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
        "CBZ" | "CBR" => {
            let comic = comics::inspect_cbz(p)?;
            let cover_image_data = if !comic.page_names.is_empty() {
                comics::extract_cbz_page(p, 0).ok().map(|bytes| {
                    let first_name = comic.page_names[0].to_lowercase();
                    let mime = if first_name.ends_with(".png") {
                        "image/png"
                    } else if first_name.ends_with(".webp") {
                        "image/webp"
                    } else {
                        "image/jpeg"
                    };
                    format!("data:{};base64,{}", mime, epub::base64_encode(&bytes))
                })
            } else {
                None
            };

            Ok(DocumentOverview {
                title: comic.title,
                format: ext,
                page_count: comic.page_count as i32,
                authors: Vec::new(),
                cover_image_data,
                description: None,
            })
        }
        "TXT" | "MD" | "MARKDOWN" => {
            let title = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Text Document").to_string();
            let format = if ext == "MD" || ext == "MARKDOWN" {
                "MD".to_string()
            } else {
                "TXT".to_string()
            };
            Ok(DocumentOverview {
                title,
                format,
                page_count: 1,
                authors: Vec::new(),
                cover_image_data: None,
                description: None,
            })
        }
        _ => Err(format!("Unsupported file format: .{}", ext)),
    }
}

