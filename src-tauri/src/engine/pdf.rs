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

    let mut title = path
        .as_ref()
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled Document")
        .to_string();
    let mut author = None;
    let mut subject = None;

    if let Ok(info_ref) = doc.trailer.get(b"Info") {
        let info_obj = match info_ref {
            lopdf::Object::Reference(id) => doc.get_object(*id).ok(),
            other => Some(other),
        };
        if let Some(lopdf::Object::Dictionary(dict)) = info_obj {
            let extract_str = |key: &[u8]| -> Option<String> {
                let val_ref = dict.get(key).ok()?;
                let val_obj = match val_ref {
                    lopdf::Object::Reference(id) => doc.get_object(*id).ok()?,
                    other => other,
                };
                match val_obj {
                    lopdf::Object::String(bytes, _) => {
                        let s = String::from_utf8_lossy(bytes).trim().to_string();
                        if !s.is_empty() {
                            Some(s)
                        } else {
                            None
                        }
                    }
                    _ => None,
                }
            };

            if let Some(t) = extract_str(b"Title") {
                title = t;
            }
            author = extract_str(b"Author");
            subject = extract_str(b"Subject");
        }
    }

    Ok(PdfMetadata {
        title,
        author,
        subject,
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
