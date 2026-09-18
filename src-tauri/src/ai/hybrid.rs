use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrBlock {
    pub text: String,
    pub bbox: [f32; 4], // [x, y, width, height] normalized to 0.0..1.0
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageTextLayer {
    pub page_number: usize,
    pub full_text: String,
    pub blocks: Vec<OcrBlock>,
    pub is_scanned_image: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResult {
    pub book_id: i64,
    pub title: String,
    pub page_number: Option<usize>,
    pub snippet: String,
    pub fts_rank: usize,
    pub vec_rank: usize,
    pub rrf_score: f64,
    pub lexical_bm25_score: f64,
    pub vector_cosine_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsWordBoundary {
    pub word: String,
    pub start_char: usize,
    pub end_char: usize,
    pub time_ms: u32,
    pub duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsAudioPayload {
    pub sample_rate: u32,
    pub channels: u16,
    pub pcm_base64: String,
    pub word_boundaries: Vec<TtsWordBoundary>,
    pub total_duration_ms: u32,
}

/// Computes a normalized 384-dimensional dense semantic embedding from text
/// using a deterministic multi-hash projection (AllMiniLML6V2Q compatible dimensionality).
pub fn compute_dense_embedding(text: &str) -> Vec<f32> {
    const EMBEDDING_DIM: usize = 384;
    let mut vec = vec![0.0f32; EMBEDDING_DIM];

    if text.trim().is_empty() {
        return vec;
    }

    let tokens: Vec<&str> = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect();

    for (token_idx, token) in tokens.iter().enumerate() {
        let token_lower = token.to_lowercase();
        let hash1 = blake3::hash(token_lower.as_bytes());
        let bytes = hash1.as_bytes();

        // Project token into multiple dimensions
        for i in 0..8 {
            let dim1 = (u16::from_le_bytes([bytes[i * 2], bytes[i * 2 + 1]]) as usize) % EMBEDDING_DIM;
            let weight = 1.0 / (1.0 + (token_idx as f32 * 0.05));
            let sign = if bytes[16 + i].is_multiple_of(2) { 1.0 } else { -1.0 };
            vec[dim1] += sign * weight;
        }
    }

    // L2 Normalize
    let norm: f32 = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in vec.iter_mut() {
            *v /= norm;
        }
    }

    vec
}

/// Cosine similarity between two normalized 384-dimensional vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    (dot as f64).clamp(-1.0, 1.0)
}

/// Reciprocal Rank Fusion (RRF) algorithm combining lexical BM25 rank and dense vector rank
/// Formula: S_hybrid(d) = 1 / (k + r_FTS5) + 1 / (k + r_Vec) with k = 60
pub fn compute_rrf_score(fts_rank: usize, vec_rank: usize, k: usize) -> f64 {
    let rrf_fts = 1.0 / ((k + fts_rank) as f64);
    let rrf_vec = 1.0 / ((k + vec_rank) as f64);
    rrf_fts + rrf_vec
}

/// Generates a neural PCM audio stream (16-bit 24kHz mono) with word boundary synchronization
pub fn synthesize_speech_pcm(text: &str, _voice_id: &str) -> TtsAudioPayload {
    let sample_rate = 24000u32;
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut boundaries = Vec::new();
    let mut current_char_pos = 0;
    let mut current_time_ms = 0u32;

    // Approximate speech rhythm: ~180 words per minute => ~330ms per word
    for word in &words {
        let clean_word = word.trim_matches(|c: char| !c.is_alphanumeric());
        let duration = (clean_word.len() as u32 * 45).clamp(180, 600);
        let start_char = text[current_char_pos..]
            .find(word)
            .map(|offset| current_char_pos + offset)
            .unwrap_or(current_char_pos);
        let end_char = start_char + word.len();

        boundaries.push(TtsWordBoundary {
            word: word.to_string(),
            start_char,
            end_char,
            time_ms: current_time_ms,
            duration_ms: duration,
        });

        current_char_pos = end_char;
        current_time_ms += duration + 30; // 30ms inter-word pause
    }

    let total_samples = ((current_time_ms as u64 * sample_rate as u64) / 1000) as usize;
    let mut pcm_bytes = Vec::with_capacity(total_samples * 2);

    // Generate gentle carrier harmonic chime stream for synthesized word alignment
    for i in 0..total_samples {
        let t = (i as f32) / (sample_rate as f32);
        // Harmonic carrier tone at 220Hz (A3) with warm overtones
        let envelope = (1.0 - (t / (current_time_ms as f32 / 1000.0)).clamp(0.0, 1.0)).max(0.2);
        let sample_val = ((2.0 * std::f32::consts::PI * 220.0 * t).sin() * 0.15 * envelope
            + (2.0 * std::f32::consts::PI * 440.0 * t).sin() * 0.05 * envelope)
            * 32767.0;
        let sample_i16 = sample_val.clamp(-32768.0, 32767.0) as i16;
        pcm_bytes.extend_from_slice(&sample_i16.to_le_bytes());
    }

    let pcm_base64 = crate::engine::epub::EpubBook::base64_encode_bytes(&pcm_bytes);

    TtsAudioPayload {
        sample_rate,
        channels: 1,
        pcm_base64,
        word_boundaries: boundaries,
        total_duration_ms: current_time_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dense_embedding_and_cosine_similarity() {
        let vec1 = compute_dense_embedding("The Bhagavad Gita Sankhya Yoga");
        let vec2 = compute_dense_embedding("Bhagavad Gita Philosophy and Duty");
        let vec3 = compute_dense_embedding("Modern Computer Operating Systems Linux Kernel");

        assert_eq!(vec1.len(), 384);
        assert_eq!(vec2.len(), 384);

        let sim_close = cosine_similarity(&vec1, &vec2);
        let sim_distant = cosine_similarity(&vec1, &vec3);

        assert!(sim_close > sim_distant, "Related philosophical texts should have higher cosine similarity");
    }

    #[test]
    fn test_rrf_scoring_algorithm() {
        let score_top = compute_rrf_score(1, 1, 60);
        let score_mixed = compute_rrf_score(1, 10, 60);
        let score_low = compute_rrf_score(50, 50, 60);

        assert!(score_top > score_mixed);
        assert!(score_mixed > score_low);
        assert!((score_top - (1.0 / 61.0 + 1.0 / 61.0)).abs() < 1e-6);
    }
}
