use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookView {
    pub id: i64,
    pub uuid: String,
    pub title: String,
    pub authors: Vec<String>,
    pub series: Option<String>,
    pub series_index: Option<f64>,
    pub file_format: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub page_count: i32,
    pub publisher: Option<String>,
    pub publication_year: Option<i32>,
    pub description: Option<String>,
    pub isbn: Option<String>,
    pub tags: Vec<String>,
    pub progress_percentage: f64,
    pub current_page: i32,
    pub last_read_at: Option<String>,
    pub cover_image_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryStats {
    pub total_books: i64,
    pub total_authors: i64,
    pub total_series: i64,
    pub formats: Vec<(String, i64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMetadataUpdate {
    pub id: i64,
    pub title: String,
    pub authors: Vec<String>,
    pub series: Option<String>,
    pub series_index: Option<f64>,
    pub tags: Vec<String>,
    pub publisher: Option<String>,
    pub publication_year: Option<i32>,
    pub description: Option<String>,
    pub isbn: Option<String>,
}

pub fn get_all_books(conn: &Connection) -> Result<Vec<BookView>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT 
            b.id, b.uuid, b.title, b.file_path, b.file_size_bytes, b.file_format,
            b.page_count, b.publisher, b.publication_year, b.description, b.isbn,
            b.cover_image_path,
            COALESCE((SELECT GROUP_CONCAT(a.name, '||') FROM authors a JOIN book_authors ba ON a.id = ba.author_id WHERE ba.book_id = b.id), '') as authors_str,
            (SELECT s.name FROM series s JOIN book_series bs ON s.id = bs.series_id WHERE bs.book_id = b.id) as series_name,
            (SELECT bs.sequence_index FROM book_series bs WHERE bs.book_id = b.id) as series_idx,
            COALESCE((SELECT GROUP_CONCAT(t.name, '||') FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = b.id), '') as tags_str,
            COALESCE(rp.progress_percentage, 0.0) as progress,
            COALESCE(rp.current_page, 0) as cur_page,
            rp.last_read_at
        FROM books b
        LEFT JOIN reading_progress rp ON b.id = rp.book_id
        ORDER BY b.id DESC
        "#
    )?;

    let book_iter = stmt.query_map([], |row| {
        let authors_str: String = row.get(12)?;
        let authors = if authors_str.is_empty() {
            Vec::new()
        } else {
            authors_str.split("||").map(|s| s.to_string()).collect()
        };

        let tags_str: String = row.get(15)?;
        let tags = if tags_str.is_empty() {
            Vec::new()
        } else {
            tags_str.split("||").map(|s| s.to_string()).collect()
        };

        Ok(BookView {
            id: row.get(0)?,
            uuid: row.get(1)?,
            title: row.get(2)?,
            file_path: row.get(3)?,
            file_size_bytes: row.get(4)?,
            file_format: row.get(5)?,
            page_count: row.get(6)?,
            publisher: row.get(7)?,
            publication_year: row.get(8)?,
            description: row.get(9)?,
            isbn: row.get(10)?,
            cover_image_path: row.get(11)?,
            authors,
            series: row.get(13)?,
            series_index: row.get(14)?,
            tags,
            progress_percentage: row.get(16)?,
            current_page: row.get(17)?,
            last_read_at: row.get(18)?,
        })
    })?;

    let mut result = Vec::new();
    for book in book_iter {
        result.push(book?);
    }
    Ok(result)
}

pub fn sanitize_fts5_query(query: &str) -> String {
    let tokens: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("\"{}\"*", s.trim()))
        .collect();

    tokens.join(" ")
}

pub fn search_books_fts(conn: &Connection, query: &str) -> Result<Vec<BookView>> {
    let sanitized_query = sanitize_fts5_query(query);
    if sanitized_query.is_empty() {
        return get_all_books(conn);
    }

    let mut stmt = conn.prepare(
        r#"
        SELECT 
            b.id, b.uuid, b.title, b.file_path, b.file_size_bytes, b.file_format,
            b.page_count, b.publisher, b.publication_year, b.description, b.isbn,
            b.cover_image_path,
            COALESCE((SELECT GROUP_CONCAT(a.name, '||') FROM authors a JOIN book_authors ba ON a.id = ba.author_id WHERE ba.book_id = b.id), '') as authors_str,
            (SELECT s.name FROM series s JOIN book_series bs ON s.id = bs.series_id WHERE bs.book_id = b.id) as series_name,
            (SELECT bs.sequence_index FROM book_series bs WHERE bs.book_id = b.id) as series_idx,
            COALESCE((SELECT GROUP_CONCAT(t.name, '||') FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = b.id), '') as tags_str,
            COALESCE(rp.progress_percentage, 0.0) as progress,
            COALESCE(rp.current_page, 0) as cur_page,
            rp.last_read_at
        FROM books b
        JOIN books_fts fts ON b.id = fts.rowid
        LEFT JOIN reading_progress rp ON b.id = rp.book_id
        WHERE books_fts MATCH ?
        ORDER BY rank
        "#
    )?;

    let book_iter = stmt.query_map([sanitized_query], |row| {
        let authors_str: String = row.get(12)?;
        let authors = if authors_str.is_empty() {
            Vec::new()
        } else {
            authors_str.split("||").map(|s| s.to_string()).collect()
        };

        let tags_str: String = row.get(15)?;
        let tags = if tags_str.is_empty() {
            Vec::new()
        } else {
            tags_str.split("||").map(|s| s.to_string()).collect()
        };

        Ok(BookView {
            id: row.get(0)?,
            uuid: row.get(1)?,
            title: row.get(2)?,
            file_path: row.get(3)?,
            file_size_bytes: row.get(4)?,
            file_format: row.get(5)?,
            page_count: row.get(6)?,
            publisher: row.get(7)?,
            publication_year: row.get(8)?,
            description: row.get(9)?,
            isbn: row.get(10)?,
            cover_image_path: row.get(11)?,
            authors,
            series: row.get(13)?,
            series_index: row.get(14)?,
            tags,
            progress_percentage: row.get(16)?,
            current_page: row.get(17)?,
            last_read_at: row.get(18)?,
        })
    })?;

    let mut result = Vec::new();
    for book in book_iter {
        result.push(book?);
    }
    Ok(result)
}

#[allow(clippy::too_many_arguments)]
pub fn insert_book(
    conn: &Connection,
    uuid: &str,
    blake3_hash: &str,
    title: &str,
    file_path: &str,
    file_size_bytes: i64,
    file_format: &str,
    page_count: i32,
    authors: &[String],
    series: Option<&str>,
    series_index: Option<f64>,
    tags: &[String],
    publisher: Option<&str>,
    pub_year: Option<i32>,
    description: Option<&str>,
    isbn: Option<&str>,
    cover_image_path: Option<&str>,
) -> Result<i64> {
    let sort_title = title.to_lowercase();
    conn.execute(
        r#"
        INSERT INTO books (
            uuid, blake3_hash, title, sort_title, file_path, file_size_bytes,
            file_format, page_count, publisher, publication_year, description, isbn, cover_image_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        params![
            uuid, blake3_hash, title, sort_title, file_path, file_size_bytes,
            file_format, page_count, publisher, pub_year, description, isbn, cover_image_path
        ],
    )?;

    let book_id = conn.last_insert_rowid();

    // Link authors
    for author_name in authors {
        let trimmed = author_name.trim();
        if !trimmed.is_empty() {
            conn.execute(
                "INSERT OR IGNORE INTO authors (name, sort_name) VALUES (?, ?)",
                params![trimmed, trimmed.to_lowercase()],
            )?;
            let author_id: i64 = conn.query_row(
                "SELECT id FROM authors WHERE name = ?",
                params![trimmed],
                |r| r.get(0),
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO book_authors (book_id, author_id) VALUES (?, ?)",
                params![book_id, author_id],
            )?;
        }
    }

    // Link Series
    if let Some(ser) = series {
        let ser_trimmed = ser.trim();
        if !ser_trimmed.is_empty() {
            conn.execute(
                "INSERT OR IGNORE INTO series (name, sort_name) VALUES (?, ?)",
                params![ser_trimmed, ser_trimmed.to_lowercase()],
            )?;
            let series_id: i64 = conn.query_row(
                "SELECT id FROM series WHERE name = ?",
                params![ser_trimmed],
                |r| r.get(0),
            )?;
            let idx = series_index.unwrap_or(1.0);
            conn.execute(
                "INSERT OR REPLACE INTO book_series (book_id, series_id, sequence_index) VALUES (?, ?, ?)",
                params![book_id, series_id, idx],
            )?;
        }
    }

    // Link Tags
    for tag_name in tags {
        let trimmed = tag_name.trim();
        if !trimmed.is_empty() {
            conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?)",
                params![trimmed],
            )?;
            let tag_id: i64 = conn.query_row(
                "SELECT id FROM tags WHERE name = ?",
                params![trimmed],
                |r| r.get(0),
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)",
                params![book_id, tag_id],
            )?;
        }
    }

    // Sync FTS index
    sync_book_fts(conn, book_id)?;

    Ok(book_id)
}

pub fn sync_book_fts(conn: &Connection, book_id: i64) -> Result<()> {
    conn.execute("DELETE FROM books_fts WHERE rowid = ?", params![book_id])?;
    conn.execute(
        r#"
        INSERT INTO books_fts (rowid, title, author_list, series_name, tag_list, description)
        SELECT 
            b.id,
            b.title,
            COALESCE((SELECT GROUP_CONCAT(a.name, ', ') FROM authors a JOIN book_authors ba ON a.id = ba.author_id WHERE ba.book_id = b.id), ''),
            COALESCE((SELECT s.name FROM series s JOIN book_series bs ON s.id = bs.series_id WHERE bs.book_id = b.id), ''),
            COALESCE((SELECT GROUP_CONCAT(t.name, ', ') FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = b.id), ''),
            COALESCE(b.description, '')
        FROM books b
        WHERE b.id = ?
        "#,
        params![book_id],
    )?;
    Ok(())
}

pub fn update_reading_progress(
    conn: &Connection,
    book_id: i64,
    current_page: i32,
    current_cfi: Option<&str>,
    progress_percentage: f64,
) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO reading_progress (book_id, current_page, current_cfi, progress_percentage, last_read_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(book_id) DO UPDATE SET
            current_page = excluded.current_page,
            current_cfi = excluded.current_cfi,
            progress_percentage = excluded.progress_percentage,
            last_read_at = CURRENT_TIMESTAMP
        "#,
        params![book_id, current_page, current_cfi, progress_percentage],
    )?;
    Ok(())
}

pub fn update_book_metadata(conn: &Connection, update: &BookMetadataUpdate) -> Result<()> {
    conn.execute(
        r#"
        UPDATE books SET
            title = ?,
            sort_title = ?,
            publisher = ?,
            publication_year = ?,
            description = ?,
            isbn = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
        params![
            update.title,
            update.title.to_lowercase(),
            update.publisher,
            update.publication_year,
            update.description,
            update.isbn,
            update.id
        ],
    )?;

    // Refresh authors
    conn.execute("DELETE FROM book_authors WHERE book_id = ?", params![update.id])?;
    for author_name in &update.authors {
        let trimmed = author_name.trim();
        if !trimmed.is_empty() {
            conn.execute("INSERT OR IGNORE INTO authors (name, sort_name) VALUES (?, ?)", params![trimmed, trimmed.to_lowercase()])?;
            let author_id: i64 = conn.query_row("SELECT id FROM authors WHERE name = ?", params![trimmed], |r| r.get(0))?;
            conn.execute("INSERT OR IGNORE INTO book_authors (book_id, author_id) VALUES (?, ?)", params![update.id, author_id])?;
        }
    }

    // Refresh series
    conn.execute("DELETE FROM book_series WHERE book_id = ?", params![update.id])?;
    if let Some(ser) = &update.series {
        let ser_trimmed = ser.trim();
        if !ser_trimmed.is_empty() {
            conn.execute("INSERT OR IGNORE INTO series (name, sort_name) VALUES (?, ?)", params![ser_trimmed, ser_trimmed.to_lowercase()])?;
            let series_id: i64 = conn.query_row("SELECT id FROM series WHERE name = ?", params![ser_trimmed], |r| r.get(0))?;
            conn.execute(
                "INSERT OR REPLACE INTO book_series (book_id, series_id, sequence_index) VALUES (?, ?, ?)",
                params![update.id, series_id, update.series_index.unwrap_or(1.0)],
            )?;
        }
    }

    // Refresh tags
    conn.execute("DELETE FROM book_tags WHERE book_id = ?", params![update.id])?;
    for tag_name in &update.tags {
        let trimmed = tag_name.trim();
        if !trimmed.is_empty() {
            conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", params![trimmed])?;
            let tag_id: i64 = conn.query_row("SELECT id FROM tags WHERE name = ?", params![trimmed], |r| r.get(0))?;
            conn.execute("INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)", params![update.id, tag_id])?;
        }
    }

    // Refresh FTS index
    sync_book_fts(conn, update.id)?;

    Ok(())
}

pub fn delete_book(conn: &Connection, book_id: i64) -> Result<()> {
    conn.execute("DELETE FROM books_fts WHERE rowid = ?", params![book_id])?;
    conn.execute("DELETE FROM books WHERE id = ?", params![book_id])?;
    Ok(())
}

pub fn get_library_stats(conn: &Connection) -> Result<LibraryStats> {
    let total_books: i64 = conn.query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))?;
    let total_authors: i64 = conn.query_row("SELECT COUNT(*) FROM authors", [], |r| r.get(0))?;
    let total_series: i64 = conn.query_row("SELECT COUNT(*) FROM series", [], |r| r.get(0))?;

    let mut stmt = conn.prepare("SELECT file_format, COUNT(*) FROM books GROUP BY file_format")?;
    let format_rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;

    let mut formats = Vec::new();
    for row in format_rows {
        formats.push(row?);
    }

    Ok(LibraryStats {
        total_books,
        total_authors,
        total_series,
        formats,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotationView {
    pub id: i64,
    pub uuid: String,
    pub book_id: i64,
    pub annotation_type: String,
    pub page_index: Option<i32>,
    pub selected_text: Option<String>,
    pub note_comment: Option<String>,
    pub color_hex: String,
    pub created_at: String,
}

pub fn insert_annotation(
    conn: &Connection,
    book_id: i64,
    annotation_type: &str,
    page_index: Option<i32>,
    selected_text: Option<&str>,
    note_comment: Option<&str>,
    color_hex: &str,
) -> Result<AnnotationView> {
    let ann_uuid = uuid::Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO annotations (uuid, book_id, annotation_type, page_index, selected_text, note_comment, color_hex)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
        params![ann_uuid, book_id, annotation_type, page_index, selected_text, note_comment, color_hex],
    )?;

    let id = conn.last_insert_rowid();

    let mut stmt = conn.prepare("SELECT uuid, created_at FROM annotations WHERE id = ?")?;
    let (uuid_val, created_at) = stmt.query_row(params![id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;

    Ok(AnnotationView {
        id,
        uuid: uuid_val,
        book_id,
        annotation_type: annotation_type.to_string(),
        page_index,
        selected_text: selected_text.map(|s| s.to_string()),
        note_comment: note_comment.map(|s| s.to_string()),
        color_hex: color_hex.to_string(),
        created_at,
    })
}

pub fn get_annotations_for_book(conn: &Connection, book_id: i64) -> Result<Vec<AnnotationView>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, uuid, book_id, annotation_type, page_index, selected_text, note_comment, color_hex, created_at
        FROM annotations
        WHERE book_id = ?
        ORDER BY id ASC
        "#
    )?;

    let rows = stmt.query_map(params![book_id], |row| {
        Ok(AnnotationView {
            id: row.get(0)?,
            uuid: row.get(1)?,
            book_id: row.get(2)?,
            annotation_type: row.get(3)?,
            page_index: row.get(4)?,
            selected_text: row.get(5)?,
            note_comment: row.get(6)?,
            color_hex: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn delete_annotation(conn: &Connection, annotation_id: i64) -> Result<()> {
    conn.execute("DELETE FROM annotations WHERE id = ?", params![annotation_id])?;
    Ok(())
}

pub fn export_catalog_as_json(conn: &Connection) -> Result<String> {
    let books = get_all_books(conn)?;
    serde_json::to_string_pretty(&books).map_err(|_| rusqlite::Error::InvalidQuery)
}

pub fn export_catalog_as_csv(conn: &Connection) -> Result<String> {
    let books = get_all_books(conn)?;
    let mut csv = String::from("ID,UUID,Title,Authors,Series,SeriesIndex,Format,FileSize,PageCount,Publisher,Year,ISBN,Tags\n");

    for b in books {
        let authors = b.authors.join("; ").replace('"', "\"\"");
        let tags = b.tags.join("; ").replace('"', "\"\"");
        let title = b.title.replace('"', "\"\"");
        let series = b.series.unwrap_or_default().replace('"', "\"\"");
        let publisher = b.publisher.unwrap_or_default().replace('"', "\"\"");
        let isbn = b.isbn.unwrap_or_default().replace('"', "\"\"");

        csv.push_str(&format!(
            "{},\"{}\",\"{}\",\"{}\",\"{}\",{},{},{},{},\"{}\",{},\"{}\",\"{}\"\n",
            b.id,
            b.uuid,
            title,
            authors,
            series,
            b.series_index.unwrap_or(0.0),
            b.file_format,
            b.file_size_bytes,
            b.page_count,
            publisher,
            b.publication_year.unwrap_or(0),
            isbn,
            tags
        ));
    }

    Ok(csv)
}

