use std::path::Path;

/// Computes a 64-bit difference hash (dHash) on an image file.
/// Resizes the image to 9x8 grayscale, compares horizontal pixel intensities,
/// and produces a 64-bit integer hash.
pub fn compute_image_dhash(image_path: &Path) -> Result<u64, String> {
    if !image_path.exists() {
        return Err(format!("Image file not found: {:?}", image_path));
    }

    let img = image::open(image_path)
        .map_err(|e| format!("Failed to open cover image for hashing: {}", e))?;

    // Convert to 9x8 grayscale image
    let gray = img.grayscale().resize_exact(9, 8, image::imageops::FilterType::Triangle).to_luma8();
    let mut hash = 0u64;

    for y in 0..8 {
        for x in 0..8 {
            let p_left = gray.get_pixel(x, y)[0];
            let p_right = gray.get_pixel(x + 1, y)[0];
            if p_left > p_right {
                let bit_index = y * 8 + x;
                hash |= 1 << bit_index;
            }
        }
    }

    Ok(hash)
}

/// Computes Hamming distance between two 64-bit perceptual hashes
/// Formula: D_Hamming(h1, h2) = count_ones(h1 ^ h2)
pub fn hamming_distance(h1: u64, h2: u64) -> u32 {
    (h1 ^ h2).count_ones()
}

/// Checks if two cover images are perceptual duplicates (Hamming distance <= 10 out of 64)
pub fn are_covers_visually_similar(h1: u64, h2: u64, threshold: u32) -> bool {
    hamming_distance(h1, h2) <= threshold
}

/// Computes the Levenshtein distance between two strings
pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let v1: Vec<char> = s1.chars().collect();
    let v2: Vec<char> = s2.chars().collect();
    let len1 = v1.len();
    let len2 = v2.len();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut prev_row: Vec<usize> = (0..=len2).collect();
    let mut curr_row: Vec<usize> = vec![0; len2 + 1];

    for (i, &ch1) in v1.iter().enumerate() {
        curr_row[0] = i + 1;
        for j in 0..len2 {
            let cost = if ch1.to_lowercase().eq(v2[j].to_lowercase()) { 0 } else { 1 };
            curr_row[j + 1] = (curr_row[j] + 1)
                .min(prev_row[j + 1] + 1)
                .min(prev_row[j] + cost);
        }
        prev_row.copy_from_slice(&curr_row);
    }

    prev_row[len2]
}

/// Computes normalized string similarity in range [0.0, 1.0]
pub fn string_similarity(s1: &str, s2: &str) -> f64 {
    let max_len = s1.chars().count().max(s2.chars().count());
    if max_len == 0 {
        return 1.0;
    }
    let dist = levenshtein_distance(s1, s2);
    1.0 - (dist as f64 / max_len as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hamming_distance() {
        let h1 = 0b10101010u64;
        let h2 = 0b10101011u64;
        assert_eq!(hamming_distance(h1, h2), 1);

        let h3 = 0b00000000u64;
        let h4 = 0b11111111u64;
        assert_eq!(hamming_distance(h3, h4), 8);
    }

    #[test]
    fn test_levenshtein_string_similarity() {
        let sim1 = string_similarity("Surya Siddhanta", "Surya Siddhanta");
        assert_eq!(sim1, 1.0);

        let sim2 = string_similarity("Surya Siddhanta", "Surya Siddhant");
        assert!(sim2 > 0.9);

        let sim3 = string_similarity("Surya Siddhanta", "Computer Architecture");
        assert!(sim3 < 0.3);
    }
}
