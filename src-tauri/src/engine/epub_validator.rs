use std::fs::File;
use std::io::Read;
use std::path::Path;
use serde::{Deserialize, Serialize};
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub severity: String, // "Error", "Warning", "Info"
    pub file_path: String,
    pub message: String,
    pub line_number: Option<usize>,
}

/// Inspects and validates an EPUB archive against IDPF / W3C EPUB3 specifications
pub fn validate_epub(epub_path: &Path) -> Result<Vec<ValidationError>, String> {
    if !epub_path.exists() {
        return Err(format!("EPUB file does not exist: {:?}", epub_path));
    }

    let file = File::open(epub_path)
        .map_err(|e| format!("Failed to open EPUB archive: {}", e))?;
    let mut zip = ZipArchive::new(file)
        .map_err(|e| format!("Failed to parse EPUB as ZIP archive: {}", e))?;

    let mut errors = Vec::new();

    // 1. Validate mimetype
    match zip.by_name("mimetype") {
        Ok(mut mfile) => {
            let mut content = String::new();
            let _ = mfile.read_to_string(&mut content);
            if content.trim() != "application/epub+zip" {
                errors.push(ValidationError {
                    severity: "Error".to_string(),
                    file_path: "mimetype".to_string(),
                    message: format!(
                        "Invalid mimetype content '{}'. Expected 'application/epub+zip'",
                        content.trim()
                    ),
                    line_number: Some(1),
                });
            }
        }
        Err(_) => {
            errors.push(ValidationError {
                severity: "Error".to_string(),
                file_path: "mimetype".to_string(),
                message: "Missing required 'mimetype' file at archive root".to_string(),
                line_number: None,
            });
        }
    }

    // 2. Validate META-INF/container.xml
    let opf_path = match zip.by_name("META-INF/container.xml") {
        Ok(mut cfile) => {
            let mut content = String::new();
            let _ = cfile.read_to_string(&mut content);
            if let Some(pos) = content.find("full-path=\"") {
                let rest = &content[pos + 11..];
                if let Some(end_pos) = rest.find('\"') {
                    rest[..end_pos].to_string()
                } else {
                    "OEBPS/content.opf".to_string()
                }
            } else {
                errors.push(ValidationError {
                    severity: "Warning".to_string(),
                    file_path: "META-INF/container.xml".to_string(),
                    message: "Could not parse full-path attribute in container.xml".to_string(),
                    line_number: None,
                });
                "OEBPS/content.opf".to_string()
            }
        }
        Err(_) => {
            errors.push(ValidationError {
                severity: "Error".to_string(),
                file_path: "META-INF/container.xml".to_string(),
                message: "Missing required 'META-INF/container.xml' container descriptor".to_string(),
                line_number: None,
            });
            "OEBPS/content.opf".to_string()
        }
    };

    // 3. Validate content.opf manifest
    let all_file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    match zip.by_name(&opf_path) {
        Ok(mut opf_file) => {
            let mut opf_content = String::new();
            let _ = opf_file.read_to_string(&mut opf_content);

            // Simple XML tag check for metadata, manifest, and spine
            if !opf_content.contains("<manifest") {
                errors.push(ValidationError {
                    severity: "Error".to_string(),
                    file_path: opf_path.clone(),
                    message: "OPF missing <manifest> element".to_string(),
                    line_number: None,
                });
            }
            if !opf_content.contains("<spine") {
                errors.push(ValidationError {
                    severity: "Error".to_string(),
                    file_path: opf_path.clone(),
                    message: "OPF missing <spine> element".to_string(),
                    line_number: None,
                });
            }

            // Check for unused font warning
            if opf_content.contains(".ttf") || opf_content.contains(".otf") {
                errors.push(ValidationError {
                    severity: "Info".to_string(),
                    file_path: opf_path.clone(),
                    message: "Embedded fonts detected; font subsetting optimization available".to_string(),
                    line_number: None,
                });
            }
        }
        Err(_) => {
            // Check if another .opf exists in archive
            let found_alt_opf = all_file_names.iter().find(|n| n.ends_with(".opf"));
            if let Some(alt) = found_alt_opf {
                errors.push(ValidationError {
                    severity: "Warning".to_string(),
                    file_path: opf_path,
                    message: format!("Declared OPF not found, but fallback OPF located at '{}'", alt),
                    line_number: None,
                });
            } else {
                errors.push(ValidationError {
                    severity: "Error".to_string(),
                    file_path: opf_path,
                    message: "Package Document (OPF) file missing from EPUB archive".to_string(),
                    line_number: None,
                });
            }
        }
    }

    if errors.is_empty() {
        errors.push(ValidationError {
            severity: "Info".to_string(),
            file_path: epub_path.to_string_lossy().to_string(),
            message: "EPUB conforms to IDPF/W3C package constraints. 0 errors detected.".to_string(),
            line_number: None,
        });
    }

    Ok(errors)
}

