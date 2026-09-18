use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpubMetadata {
    pub title: String,
    pub creators: Vec<String>,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub language: String,
    pub cover_image_data: Option<String>, // Base64 data URL
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocItem {
    pub title: String,
    pub href: String,
    pub children: Vec<TocItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpubChapter {
    pub id: String,
    pub title: String,
    pub href: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpubBook {
    pub metadata: EpubMetadata,
    pub chapters: Vec<EpubChapter>,
    pub toc: Vec<TocItem>,
}

pub fn parse_epub<P: AsRef<Path>>(path: P) -> Result<EpubBook, String> {
    let file = File::open(path.as_ref()).map_err(|e| format!("Failed to open EPUB file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

    // 1. Locate rootfile from META-INF/container.xml
    let opf_path = get_opf_path(&mut archive)?;
    let opf_dir = Path::new(&opf_path)
        .parent()
        .map(|p| p.to_str().unwrap_or(""))
        .unwrap_or("");

    // 2. Read OPF content
    let mut opf_file = archive
        .by_name(&opf_path)
        .map_err(|e| format!("Missing OPF file {}: {}", opf_path, e))?;
    let mut opf_xml = String::new();
    opf_file
        .read_to_string(&mut opf_xml)
        .map_err(|e| format!("Failed to read OPF file: {}", e))?;
    drop(opf_file);

    // 3. Parse OPF XML
    let (metadata, manifest, spine) = parse_opf_xml(&opf_xml)?;

    // 4. Resolve cover image if any
    let cover_data = resolve_cover_image(&mut archive, opf_dir, &manifest);

    let full_metadata = EpubMetadata {
        title: metadata.title,
        creators: metadata.creators,
        publisher: metadata.publisher,
        description: metadata.description,
        language: metadata.language,
        cover_image_data: cover_data,
    };

    // 5. Read Chapters according to Spine order
    let mut chapters = Vec::new();
    for (idx, idref) in spine.iter().enumerate() {
        if let Some(href) = manifest.get(idref) {
            let full_item_path = if opf_dir.is_empty() {
                href.clone()
            } else {
                format!("{}/{}", opf_dir.trim_end_matches('/'), href.trim_start_matches('/'))
            };

            if let Ok(mut item_file) = archive.by_name(&full_item_path) {
                let mut content = String::new();
                if item_file.read_to_string(&mut content).is_ok() {
                    chapters.push(EpubChapter {
                        id: idref.clone(),
                        title: format!("Section {}", idx + 1),
                        href: href.clone(),
                        content: clean_chapter_html(&content),
                    });
                }
            }
        }
    }

    Ok(EpubBook {
        metadata: full_metadata,
        chapters,
        toc: Vec::new(),
    })
}

fn get_opf_path<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>) -> Result<String, String> {
    let mut container_file = archive
        .by_name("META-INF/container.xml")
        .map_err(|_| "Missing META-INF/container.xml in EPUB".to_string())?;

    let mut xml = String::new();
    container_file
        .read_to_string(&mut xml)
        .map_err(|e| format!("Failed to read container.xml: {}", e))?;

    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                if e.name().as_ref() == b"rootfile" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"full-path" {
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            return Ok(val);
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("Error parsing container.xml: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    Err("Could not find rootfile in container.xml".to_string())
}

struct RawOpfMetadata {
    title: String,
    creators: Vec<String>,
    publisher: Option<String>,
    description: Option<String>,
    language: String,
}

type ParsedOpf = (RawOpfMetadata, HashMap<String, String>, Vec<String>);

fn parse_opf_xml(xml: &str) -> Result<ParsedOpf, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut title = "Untitled Book".to_string();
    let mut creators = Vec::new();
    let mut publisher = None;
    let mut description = None;
    let mut language = "en".to_string();

    let mut manifest = HashMap::new();
    let mut spine = Vec::new();

    let mut current_tag = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                current_tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
            }
            Ok(Event::Empty(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag_name.ends_with("item") {
                    let mut id = String::new();
                    let mut href = String::new();
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"id" {
                            id = String::from_utf8_lossy(&attr.value).to_string();
                        } else if attr.key.as_ref() == b"href" {
                            href = String::from_utf8_lossy(&attr.value).to_string();
                        }
                    }
                    if !id.is_empty() && !href.is_empty() {
                        manifest.insert(id, href);
                    }
                } else if tag_name.ends_with("itemref") {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"idref" {
                            spine.push(String::from_utf8_lossy(&attr.value).to_string());
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = e.unescape().unwrap_or_default().to_string();
                if current_tag.ends_with("title") {
                    title = text;
                } else if current_tag.ends_with("creator") {
                    creators.push(text);
                } else if current_tag.ends_with("publisher") {
                    publisher = Some(text);
                } else if current_tag.ends_with("description") {
                    description = Some(text);
                } else if current_tag.ends_with("language") {
                    language = text;
                }
            }
            Ok(Event::End(_)) => {
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    Ok((
        RawOpfMetadata {
            title,
            creators,
            publisher,
            description,
            language,
        },
        manifest,
        spine,
    ))
}

fn resolve_cover_image<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    opf_dir: &str,
    manifest: &HashMap<String, String>,
) -> Option<String> {
    // Look for cover in manifest
    let mut cover_href = None;
    for (id, href) in manifest {
        let id_lower = id.to_lowercase();
        let href_lower = href.to_lowercase();
        if (id_lower.contains("cover") || href_lower.contains("cover"))
            && (href_lower.ends_with(".jpg")
                || href_lower.ends_with(".jpeg")
                || href_lower.ends_with(".png")
                || href_lower.ends_with(".webp"))
        {
            cover_href = Some(href.clone());
            break;
        }
    }

    if let Some(href) = cover_href {
        let full_path = if opf_dir.is_empty() {
            href
        } else {
            format!("{}/{}", opf_dir.trim_end_matches('/'), href.trim_start_matches('/'))
        };

        if let Ok(mut file) = archive.by_name(&full_path) {
            let mut img_bytes = Vec::new();
            if file.read_to_end(&mut img_bytes).is_ok() {
                let mime = if full_path.ends_with(".png") {
                    "image/png"
                } else if full_path.ends_with(".webp") {
                    "image/webp"
                } else {
                    "image/jpeg"
                };
                let b64 = base64_encode(&img_bytes);
                return Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }

    None
}

fn clean_chapter_html(raw_html: &str) -> String {
    // Strip scripts and styles for security and clean typography
    let re_script = regex::Regex::new(r"(?is)<script.*?</script>").unwrap();
    let re_style = regex::Regex::new(r"(?is)<style.*?</style>").unwrap();
    let no_script = re_script.replace_all(raw_html, "");
    let no_style = re_style.replace_all(&no_script, "");
    no_style.to_string()
}

pub fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(data.len().div_ceil(3) * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        result.push(CHARSET[((n >> 18) & 63) as usize] as char);
        result.push(CHARSET[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}
