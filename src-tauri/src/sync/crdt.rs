use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorClock {
    pub node_id: String,
    pub counter: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingStateEntry {
    pub book_uuid: String,
    pub current_page: i32,
    pub progress_pct: f64,
    pub lamport_timestamp: u64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrdtStateVector {
    pub client_id: String,
    pub version: u64,
    pub reading_states: HashMap<String, ReadingStateEntry>,
}

impl CrdtStateVector {
    pub fn new(client_id: &str) -> Self {
        Self {
            client_id: client_id.to_string(),
            version: 1,
            reading_states: HashMap::new(),
        }
    }

    /// Updates local state with a new reading progress event
    pub fn record_progress(&mut self, book_uuid: &str, current_page: i32, progress_pct: f64) {
        self.version += 1;
        let entry = ReadingStateEntry {
            book_uuid: book_uuid.to_string(),
            current_page,
            progress_pct,
            lamport_timestamp: self.version,
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        self.reading_states.insert(book_uuid.to_string(), entry);
    }

    /// Merges a remote CRDT state vector using Last-Write-Wins (LWW) resolution
    pub fn merge(&mut self, remote: &CrdtStateVector) -> usize {
        let mut conflicts_resolved = 0;

        for (uuid, remote_entry) in &remote.reading_states {
            if let Some(local_entry) = self.reading_states.get_mut(uuid) {
                // If remote has a higher Lamport timestamp or higher progress, resolve to remote
                if remote_entry.lamport_timestamp > local_entry.lamport_timestamp
                    || (remote_entry.lamport_timestamp == local_entry.lamport_timestamp
                        && remote_entry.progress_pct > local_entry.progress_pct)
                {
                    *local_entry = remote_entry.clone();
                    conflicts_resolved += 1;
                }
            } else {
                // Add new remote state
                self.reading_states.insert(uuid.clone(), remote_entry.clone());
                conflicts_resolved += 1;
            }
        }

        self.version = self.version.max(remote.version) + 1;
        conflicts_resolved
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crdt_progress_merge_last_write_wins() {
        let mut device_a = CrdtStateVector::new("device-laptop");
        let mut device_b = CrdtStateVector::new("device-ereader");

        device_a.record_progress("book-gita-01", 10, 0.25);
        device_b.record_progress("book-gita-01", 15, 0.40);

        let resolved = device_a.merge(&device_b);
        assert_eq!(resolved, 1);

        let merged_entry = device_a.reading_states.get("book-gita-01").unwrap();
        assert_eq!(merged_entry.current_page, 15);
        assert_eq!(merged_entry.progress_pct, 0.40);
    }
}
