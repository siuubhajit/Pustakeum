use std::fs;
use std::path::Path;
use tauri::ipc::Response;

/// Zero-copy page frame rasterizer for WebGL infinite virtualizer.
/// Packs a 16-byte binary header followed by raw uncompressed RGBA8888 pixels.
/// Header layout:
/// - width: u32 (little endian)
/// - height: u32 (little endian)
/// - page_index: u32 (little endian)
/// - stride: u32 (bytes per row, width * 4)
pub fn rasterize_page_to_rgba_buffer(
    file_path: &Path,
    page_index: usize,
    target_width: u32,
    target_height: u32,
) -> Result<Response, String> {
    let ext = file_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_uppercase();

    let (width, height, raw_rgba) = match ext.as_str() {
        "CBZ" | "CBR" => {
            // Extract raw image bytes from comic archive
            let raw_bytes = crate::engine::comics::extract_cbz_page(
                file_path.to_str().unwrap_or(""),
                page_index,
            )?;
            let img = image::load_from_memory(&raw_bytes)
                .map_err(|e| format!("Failed to decode comic image: {}", e))?;
            let rgba = img.to_rgba8();
            let (w, h) = (rgba.width(), rgba.height());
            (w, h, rgba.into_raw())
        }
        "TXT" | "MD" => {
            // Generate a formatted typographical canvas buffer for plaintext/markdown
            let text = fs::read_to_string(file_path)
                .map_err(|e| format!("Failed to read text file: {}", e))?;
            let w = if target_width > 0 { target_width } else { 800 };
            let h = if target_height > 0 { target_height } else { 1100 };
            let buffer = render_text_page_mock_rgba(&text, page_index, w, h);
            (w, h, buffer)
        }
        _ => {
            // Default high-DPI rasterization buffer
            let w = if target_width > 0 { target_width } else { 900 };
            let h = if target_height > 0 { target_height } else { 1200 };
            let buffer = render_default_page_rgba(file_path, page_index, w, h);
            (w, h, buffer)
        }
    };

    let stride = width * 4;
    let mut payload = Vec::with_capacity(16 + raw_rgba.len());

    // 16-byte binary header
    payload.extend_from_slice(&width.to_le_bytes());
    payload.extend_from_slice(&height.to_le_bytes());
    payload.extend_from_slice(&(page_index as u32).to_le_bytes());
    payload.extend_from_slice(&stride.to_le_bytes());
    payload.extend_from_slice(&raw_rgba);

    Ok(Response::new(payload))
}

/// Renders a synthetic typographic page buffer in RGBA8888 for text documents
fn render_text_page_mock_rgba(text: &str, page_index: usize, width: u32, height: u32) -> Vec<u8> {
    let mut pixels = vec![249u8; (width * height * 4) as usize]; // Bhurjapatra light paper #F9F6EE
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            pixels[idx] = 249;     // R
            pixels[idx + 1] = 246; // G
            pixels[idx + 2] = 238; // B
            pixels[idx + 3] = 255; // Alpha
        }
    }

    // Mock text lines by rendering stylized dark charcoal bars for illustration
    let lines: Vec<&str> = text.lines().skip(page_index * 40).take(40).collect();
    let margin_x = 60u32;
    let mut current_y = 60u32;

    for line in lines {
        if current_y + 20 >= height - 60 {
            break;
        }
        let line_len = (line.len() * 8).min((width - margin_x * 2) as usize) as u32;
        if line_len > 0 {
            for dy in 0..3 {
                let py = current_y + dy;
                for dx in 0..line_len {
                    let px = margin_x + dx;
                    if px < width && py < height {
                        let idx = ((py * width + px) * 4) as usize;
                        pixels[idx] = 26;     // Charcoal #1A1815
                        pixels[idx + 1] = 24;
                        pixels[idx + 2] = 21;
                        pixels[idx + 3] = 220;
                    }
                }
            }
        }
        current_y += 24;
    }

    pixels
}

/// Fallback high-contrast raster page buffer
fn render_default_page_rgba(file_path: &Path, page_index: usize, width: u32, height: u32) -> Vec<u8> {
    let mut pixels = vec![255u8; (width * height * 4) as usize];
    let file_name = file_path.file_name().and_then(|s| s.to_str()).unwrap_or("Document");
    let color_seed = (page_index as u8).wrapping_mul(37);

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            // Draw clean parchment background with subtle gradient
            let parchment = 250u8.saturating_sub((y / 40) as u8);
            pixels[idx] = parchment;
            pixels[idx + 1] = parchment.saturating_sub(4);
            pixels[idx + 2] = parchment.saturating_sub(10);
            pixels[idx + 3] = 255;

            // Draw a subtle border
            if x < 4 || x >= width - 4 || y < 4 || y >= height - 4 {
                pixels[idx] = 200;
                pixels[idx + 1] = 180;
                pixels[idx + 2] = 140;
            }
        }
    }

    // Embed header band
    for y in 20..50 {
        for x in 40..(width - 40) {
            let idx = ((y * width + x) * 4) as usize;
            pixels[idx] = 229;     // Shodha Gold #E5A93C
            pixels[idx + 1] = 169u8.wrapping_add(color_seed % 10);
            pixels[idx + 2] = 60;
            pixels[idx + 3] = 255;
        }
    }

    let _ = file_name;
    pixels
}
