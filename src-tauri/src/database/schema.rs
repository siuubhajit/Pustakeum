pub const SCHEMA_DDL: &str = r#"
-- Books Master Table
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    blake3_hash TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sort_title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_format TEXT NOT NULL CHECK(file_format IN ('PDF', 'EPUB', 'CBZ', 'CBR', 'MOBI', 'AZW3', 'TXT', 'MD', 'MARKDOWN')),
    page_count INTEGER DEFAULT 0,
    publisher TEXT,
    publication_year INTEGER,
    description TEXT,
    language TEXT DEFAULT 'en',
    isbn TEXT,
    cover_image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Authors (Calibre-Grade Many-to-Many)
CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    role TEXT DEFAULT 'author',
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Series Management
CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_series (
    book_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    sequence_index REAL NOT NULL DEFAULT 1.0,
    PRIMARY KEY (book_id, series_id),
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
);

-- Hierarchical Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER,
    FOREIGN KEY(parent_id) REFERENCES tags(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS book_tags (
    book_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, tag_id),
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Reading State & Cross-Device Progress
CREATE TABLE IF NOT EXISTS reading_progress (
    book_id INTEGER PRIMARY KEY,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    progress_percentage REAL DEFAULT 0.0,
    current_page INTEGER DEFAULT 0,
    current_cfi TEXT,
    reading_time_seconds INTEGER DEFAULT 0,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Annotations and Highlights Matrix
CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    book_id INTEGER NOT NULL,
    annotation_type TEXT NOT NULL CHECK(annotation_type IN ('HIGHLIGHT', 'UNDERLINE', 'NOTE', 'BOOKMARK')),
    page_index INTEGER,
    cfi_range TEXT,
    selected_text TEXT,
    note_comment TEXT,
    color_hex TEXT DEFAULT '#E5A93C',
    coordinates_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- FTS5 Full-Text Indexing Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    title,
    author_list,
    series_name,
    tag_list,
    description,
    tokenize='unicode61 remove_diacritics 2'
);
"#;

