use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub section_index: usize,
    pub section_title: String,
    pub snippet: String,
    pub match_position: usize,
}

pub fn search_in_text(
    sections: &[(usize, String, String)], // (index, title, content)
    query: &str,
    max_results: usize,
) -> Vec<SearchMatch> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    if query_lower.is_empty() {
        return results;
    }

    for (sec_idx, sec_title, content) in sections {
        let content_lower = content.to_lowercase();
        let mut start_pos = 0;

        while let Some(pos) = content_lower[start_pos..].find(&query_lower) {
            let actual_pos = start_pos + pos;
            
            // Extract a window of 100 characters around the match
            let snippet_start = actual_pos.saturating_sub(50);
            let snippet_end = (actual_pos + query.len() + 50).min(content.len());
            let snippet = format!(
                "...{}...",
                &content[snippet_start..snippet_end].replace('\n', " ").replace('\r', "")
            );

            results.push(SearchMatch {
                section_index: *sec_idx,
                section_title: sec_title.clone(),
                snippet,
                match_position: actual_pos,
            });

            if results.len() >= max_results {
                return results;
            }

            start_pos = actual_pos + query_lower.len();
        }
    }

    results
}

