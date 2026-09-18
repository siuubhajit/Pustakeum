use regex::RegexBuilder;
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
    let query_trimmed = query.trim();
    if query_trimmed.is_empty() {
        return results;
    }

    let escaped = regex::escape(query_trimmed);
    let re = match RegexBuilder::new(&escaped).case_insensitive(true).build() {
        Ok(r) => r,
        Err(_) => return results,
    };

    for (sec_idx, sec_title, content) in sections {
        for mat in re.find_iter(content) {
            let actual_pos = mat.start();
            let match_end = mat.end();

            let snippet_start = safe_char_boundary_down(content, actual_pos.saturating_sub(60));
            let snippet_end = safe_char_boundary_up(content, (match_end + 60).min(content.len()));

            let snippet = format!(
                "...{}...",
                content[snippet_start..snippet_end]
                    .replace('\n', " ")
                    .replace('\r', "")
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
        }
    }

    results
}

fn safe_char_boundary_down(s: &str, mut idx: usize) -> usize {
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

fn safe_char_boundary_up(s: &str, mut idx: usize) -> usize {
    while idx < s.len() && !s.is_char_boundary(idx) {
        idx += 1;
    }
    idx
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_in_text_unicode() {
        let sections = vec![(
            0,
            "Chapter 1".to_string(),
            "श्रीमद्भगवद्गीता Chapter 1: The battlefield of Kurukshetra 📖. “Arjuna said...”".to_string(),
        )];

        let matches = search_in_text(&sections, "battlefield", 10);
        assert_eq!(matches.len(), 1);
        assert!(matches[0].snippet.contains("battlefield"));

        // Non-ASCII Sanskrit search
        let sanskrit_matches = search_in_text(&sections, "श्रीमद्भगवद्गीता", 10);
        assert_eq!(sanskrit_matches.len(), 1);

        // Smart quotes & emoji search
        let quote_matches = search_in_text(&sections, "Arjuna", 10);
        assert_eq!(quote_matches.len(), 1);
    }
}

