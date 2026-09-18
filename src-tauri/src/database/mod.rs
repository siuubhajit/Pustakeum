pub mod schema;
pub mod queries;

use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn init<P: AsRef<Path>>(db_path: P) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "synchronous", "NORMAL");
        let _ = conn.pragma_update(None, "foreign_keys", "ON");
        conn.execute_batch(schema::SCHEMA_DDL)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        let _ = conn.pragma_update(None, "foreign_keys", "ON");
        conn.execute_batch(schema::SCHEMA_DDL)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn lock_conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("Database mutex poisoned")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::queries;

    #[test]
    fn test_in_memory_db_and_fts() {
        let db = Database::in_memory().expect("Failed to init in-memory db");
        let conn = db.lock_conn();

        let id = queries::insert_book(
            &conn,
            "test-uuid-1",
            "test-hash-1",
            "The Upanishads",
            "path/to/upanishads.epub",
            1024,
            "EPUB",
            10,
            &["Ancient Rsis".to_string()],
            Some("Sacred Manuscripts"),
            Some(1.0),
            &["Philosophy".to_string(), "Vedanta".to_string()],
            Some("Pustakeum Press"),
            Some(1900),
            Some("Essential Vedic dialogues"),
            Some("978-0000000001"),
            None,
        ).expect("Failed to insert book");

        assert!(id > 0);

        let books = queries::get_all_books(&conn).expect("Failed to query books");
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].title, "The Upanishads");

        // Test FTS5 instant search
        let fts_results = queries::search_books_fts(&conn, "Vedanta").expect("FTS search failed");
        assert_eq!(fts_results.len(), 1);
        assert_eq!(fts_results[0].title, "The Upanishads");

        // Test Annotation creation & retrieval
        let ann = queries::insert_annotation(
            &conn,
            id,
            "HIGHLIGHT",
            Some(1),
            Some("Tat Tvam Asi"),
            Some("Essential Mahavakya"),
            "#E5A93C",
        ).expect("Failed to insert annotation");

        assert_eq!(ann.book_id, id);
        assert_eq!(ann.selected_text.as_deref(), Some("Tat Tvam Asi"));

        let annotations = queries::get_annotations_for_book(&conn, id).expect("Failed to get annotations");
        assert_eq!(annotations.len(), 1);

        // Test Export
        let json_export = queries::export_catalog_as_json(&conn).expect("JSON export failed");
        assert!(json_export.contains("The Upanishads"));

        let csv_export = queries::export_catalog_as_csv(&conn).expect("CSV export failed");
        assert!(csv_export.contains("The Upanishads"));

        // Test delete annotation
        queries::delete_annotation(&conn, ann.id).expect("Delete annotation failed");
        let remaining = queries::get_annotations_for_book(&conn, id).expect("Failed to query annotations");
        assert_eq!(remaining.len(), 0);

        // Test FTS query sanitization on punctuation and operators
        assert_eq!(queries::sanitize_fts5_query("Harry Potter (Book 1)"), "\"Harry\"* \"Potter\"* \"Book\"* \"1\"*");
        assert_eq!(queries::sanitize_fts5_query("rust-lang"), "\"rust\"* \"lang\"*");
        assert_eq!(queries::sanitize_fts5_query("---***+++"), "");
        assert_eq!(queries::sanitize_fts5_query(""), "");

        // Verify that searching with special characters returns results safely without crashing
        let special_results = queries::search_books_fts(&conn, "Upanishads (Sacred)*").expect("FTS search failed on special chars");
        assert_eq!(special_results.len(), 1);
        assert_eq!(special_results[0].title, "The Upanishads");
    }
}

