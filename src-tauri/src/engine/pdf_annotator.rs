use std::path::Path;
use lopdf::{Dictionary, Document, Object};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfAnnotSpec {
    pub page_number: u32,
    pub annot_type: String, // "Highlight", "Underline", "Squiggly", "StrikeOut", "Ink", "Text"
    pub rect: [f64; 4],     // [x1, y1, x2, y2]
    pub color_rgb: [f64; 3], // [r, g, b] 0.0 .. 1.0
    pub contents: Option<String>,
    pub quad_points: Option<Vec<f64>>,
    pub ink_path: Option<Vec<[f64; 2]>>, // 2D points for freehand ink
    pub epub_cfi: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct W3cAnnotation {
    #[serde(rename = "@context")]
    pub context: String,
    pub id: String,
    #[serde(rename = "type")]
    pub annot_type: String,
    pub body: W3cBody,
    pub target: W3cTarget,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct W3cBody {
    #[serde(rename = "type")]
    pub body_type: String,
    pub value: String,
    pub purpose: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct W3cTarget {
    pub source: String,
    pub selector: W3cSelector,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct W3cSelector {
    #[serde(rename = "type")]
    pub selector_type: String,
    pub value: String,
}

/// Injects a native PDF annotation dictionary directly into the binary PDF structure on disk
pub fn inject_native_pdf_annotation(file_path: &Path, annot: &PdfAnnotSpec) -> Result<(), String> {
    if !file_path.exists() {
        return Err(format!("PDF file does not exist: {:?}", file_path));
    }

    let mut doc = Document::load(file_path)
        .map_err(|e| format!("Failed to load PDF with lopdf: {}", e))?;

    let pages = doc.get_pages();
    let target_page_id = pages.get(&annot.page_number)
        .copied()
        .or_else(|| pages.values().next().copied())
        .ok_or_else(|| format!("Page {} not found in PDF", annot.page_number))?;

    // Build annotation dictionary
    let mut annot_dict = Dictionary::new();
    annot_dict.set("Type", Object::Name(b"Annot".to_vec()));

    let subtype = match annot.annot_type.to_lowercase().as_str() {
        "underline" => b"Underline".to_vec(),
        "squiggly" => b"Squiggly".to_vec(),
        "strikeout" => b"StrikeOut".to_vec(),
        "ink" => b"Ink".to_vec(),
        "text" | "note" => b"Text".to_vec(),
        _ => b"Highlight".to_vec(),
    };
    annot_dict.set("Subtype", Object::Name(subtype));

    // Bounding Box Rect
    let rect_array: Vec<Object> = annot.rect.iter().map(|&v| Object::Real(v as f32)).collect();
    annot_dict.set("Rect", Object::Array(rect_array));

    // Color array
    let color_array: Vec<Object> = annot.color_rgb.iter().map(|&c| Object::Real(c as f32)).collect();
    annot_dict.set("C", Object::Array(color_array));

    // Contents / Text notes
    if let Some(ref note) = annot.contents {
        annot_dict.set("Contents", Object::string_literal(note.clone()));
    }

    // QuadPoints for text markup
    if let Some(ref qp) = annot.quad_points {
        let qp_array: Vec<Object> = qp.iter().map(|&v| Object::Real(v as f32)).collect();
        annot_dict.set("QuadPoints", Object::Array(qp_array));
    } else {
        // Fallback QuadPoints from Rect
        let [x1, y1, x2, y2] = annot.rect;
        let qp_fallback = vec![x1, y2, x2, y2, x1, y1, x2, y1];
        let qp_array: Vec<Object> = qp_fallback.into_iter().map(|v| Object::Real(v as f32)).collect();
        annot_dict.set("QuadPoints", Object::Array(qp_array));
    }

    // InkList for freehand ink vectors with Bézier curve interpolation
    if let Some(ref ink_points) = annot.ink_path {
        let smoothed = smooth_bezier_ink_path(ink_points);
        let mut path_array = Vec::new();
        for pt in smoothed {
            path_array.push(Object::Real(pt[0] as f32));
            path_array.push(Object::Real(pt[1] as f32));
        }
        let ink_list = vec![Object::Array(path_array)];
        annot_dict.set("InkList", Object::Array(ink_list));
    }

    // Add annotation object to document
    let annot_id = doc.add_object(Object::Dictionary(annot_dict));

    // Attach to page's /Annots array
    let page_obj = doc.get_object_mut(target_page_id)
        .map_err(|e| format!("Failed to get page dictionary: {}", e))?;

    if let Object::Dictionary(ref mut page_dict) = page_obj {
        if let Ok(existing_annots) = page_dict.get_mut(b"Annots") {
            if let Object::Array(ref mut arr) = existing_annots {
                arr.push(Object::Reference(annot_id));
            }
        } else {
            let arr = vec![Object::Reference(annot_id)];
            page_dict.set("Annots", Object::Array(arr));
        }
    }

    // Save modified binary directly to disk
    doc.save(file_path).map_err(|e| format!("Failed to save modified PDF: {}", e))?;

    Ok(())
}

/// Bézier curve smoothing algorithm for freehand ink stylus paths
fn smooth_bezier_ink_path(points: &[[f64; 2]]) -> Vec<[f64; 2]> {
    if points.len() <= 2 {
        return points.to_vec();
    }

    let mut smoothed = Vec::with_capacity(points.len() * 2);
    smoothed.push(points[0]);

    for i in 1..points.len() - 1 {
        let p0 = points[i - 1];
        let p1 = points[i];
        let p2 = points[i + 1];

        // Midpoint interpolation
        let mid1 = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
        let mid2 = [(p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0];

        smoothed.push(mid1);
        smoothed.push(p1);
        smoothed.push(mid2);
    }

    smoothed.push(*points.last().unwrap());
    smoothed
}

/// Normalizes an annotation into the W3C Web Annotation JSON schema
pub fn to_w3c_annotation(book_path: &str, annot: &PdfAnnotSpec) -> W3cAnnotation {
    let target_value = if let Some(ref cfi) = annot.epub_cfi {
        cfi.clone()
    } else {
        format!("xywh=percent:{},{},{},{}", annot.rect[0], annot.rect[1], annot.rect[2], annot.rect[3])
    };

    W3cAnnotation {
        context: "http://www.w3.org/ns/anno.jsonld".to_string(),
        id: format!("urn:uuid:{}", uuid::Uuid::new_v4()),
        annot_type: "Annotation".to_string(),
        body: W3cBody {
            body_type: "TextualBody".to_string(),
            value: annot.contents.clone().unwrap_or_default(),
            purpose: "commenting".to_string(),
        },
        target: W3cTarget {
            source: book_path.to_string(),
            selector: W3cSelector {
                selector_type: if annot.epub_cfi.is_some() { "FragmentSelector".to_string() } else { "MediaFragmentSelector".to_string() },
                value: target_value,
            },
        },
        created: chrono::Utc::now().to_rfc3339(),
    }
}
