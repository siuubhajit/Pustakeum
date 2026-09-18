use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnkiCardData {
    pub front_text: String,
    pub back_text: Option<String>,
    pub cloze_text: Option<String>,
    pub source_title: String,
    pub page_number: Option<usize>,
    pub tags: Vec<String>,
}

/// Syncs a card to a local Anki instance via AnkiConnect HTTP API (port 8765)
/// with automated fallback to an offline Anki TSV deck file.
pub async fn sync_card_to_anki(
    deck_name: &str,
    card: &AnkiCardData,
    storage_dir: &Path,
) -> Result<String, String> {
    let effective_deck = if deck_name.trim().is_empty() {
        "Pustakeum Classical Deck"
    } else {
        deck_name
    };

    let is_cloze = card.cloze_text.is_some();
    let model_name = if is_cloze { "Cloze" } else { "Basic" };

    let text_field = if let Some(ref cloze) = card.cloze_text {
        cloze.clone()
    } else {
        format!("{}<br><br><i>{}</i>", card.front_text, card.back_text.as_deref().unwrap_or(""))
    };

    let extra_field = format!(
        "<b>Source:</b> {} (Page {})",
        card.source_title,
        card.page_number.map(|p| p.to_string()).unwrap_or_else(|| "N/A".to_string())
    );

    let fields = if is_cloze {
        serde_json::json!({
            "Text": text_field,
            "Extra": extra_field
        })
    } else {
        serde_json::json!({
            "Front": card.front_text,
            "Back": format!("{}<br><br>{}", card.back_text.as_deref().unwrap_or(""), extra_field)
        })
    };

    let payload = serde_json::json!({
        "action": "addNote",
        "version": 6,
        "params": {
            "note": {
                "deckName": effective_deck,
                "modelName": model_name,
                "fields": fields,
                "options": {
                    "allowDuplicate": false,
                    "duplicateScope": "deck"
                },
                "tags": card.tags
            }
        }
    });

    let payload_str = payload.to_string();

    // 1. Attempt connection to AnkiConnect on 127.0.0.1:8765
    let http_request = format!(
        "POST / HTTP/1.1\r\nHost: 127.0.0.1:8765\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        payload_str.len(),
        payload_str
    );

    match tokio::time::timeout(std::time::Duration::from_millis(1500), TcpStream::connect("127.0.0.1:8765")).await {
        Ok(Ok(mut stream)) => {
            if stream.write_all(http_request.as_bytes()).await.is_ok() {
                let mut response = Vec::new();
                let _ = stream.read_to_end(&mut response).await;
                let resp_str = String::from_utf8_lossy(&response);
                if resp_str.contains("\"error\": null") || resp_str.contains("\"result\":") {
                    return Ok(format!("Successfully created card in Anki deck '{}'", effective_deck));
                }
            }
        }
        _ => {
            // AnkiConnect not running, continue to local export fallback
        }
    }

    // 2. Fallback: Save to offline Anki TSV file
    let exports_dir = storage_dir.join("anki_exports");
    let _ = fs::create_dir_all(&exports_dir);
    let tsv_path = exports_dir.join(format!("{}.tsv", effective_deck.replace(' ', "_")));

    let tsv_line = format!(
        "{}\t{}\t{}\n",
        card.front_text.replace('\t', " ").replace('\n', "<br>"),
        card.back_text.as_deref().unwrap_or("").replace('\t', " ").replace('\n', "<br>"),
        card.tags.join(" ")
    );

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&tsv_path)
        .map_err(|e| format!("Failed to open Anki backup deck: {}", e))?;

    file.write_all(tsv_line.as_bytes())
        .map_err(|e| format!("Failed to write card to Anki backup deck: {}", e))?;

    Ok(format!(
        "AnkiConnect was offline; card saved to local Anki deck at {:?}",
        tsv_path
    ))
}

