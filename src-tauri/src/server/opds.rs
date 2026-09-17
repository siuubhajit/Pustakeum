use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::database::Database;

pub struct ServerState {
    pub db: Database,
}

pub fn create_opds_router(state: Arc<ServerState>) -> Router {
    Router::new()
        .route("/opds", get(root_catalog_feed))
        .route("/opds/books/:id/download", get(stream_book_binary))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn root_catalog_feed(State(state): State<Arc<ServerState>>) -> Response {
    let books = {
        let conn = state.db.lock_conn();
        crate::database::queries::get_all_books(&conn).unwrap_or_default()
    };

    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:pustakeum:catalog:root</id>
  <title>Pustakeum (पुस्तकम्) Digital Library</title>
  <updated>2026-09-17T00:00:00Z</updated>
"#,
    );

    for book in books {
        let mime = match book.file_format.as_str() {
            "EPUB" => "application/epub+zip",
            "PDF" => "application/pdf",
            "CBZ" => "application/x-cbz",
            _ => "application/octet-stream",
        };

        let author = book.authors.first().map(|s| s.as_str()).unwrap_or("Unknown");

        xml.push_str(&format!(
            r#"  <entry>
    <title>{}</title>
    <id>urn:uuid:{}</id>
    <author><name>{}</name></author>
    <updated>2026-09-17T00:00:00Z</updated>
    <link rel="http://opds-spec.org/acquisition" href="/opds/books/{}/download" type="{}" />
  </entry>
"#,
            book.title.replace('&', "&amp;").replace('<', "&lt;"),
            book.uuid,
            author.replace('&', "&amp;").replace('<', "&lt;"),
            book.id,
            mime
        ));
    }

    xml.push_str("</feed>");

    (
        [(
            header::CONTENT_TYPE,
            "application/atom+xml;profile=opds-catalog;charset=utf-8",
        )],
        xml,
    )
        .into_response()
}

async fn stream_book_binary(
    State(state): State<Arc<ServerState>>,
    Path(id): Path<i64>,
) -> Result<Response, StatusCode> {
    let book = {
        let conn = state.db.lock_conn();
        let mut stmt = conn
            .prepare("SELECT file_path, file_format FROM books WHERE id = ?")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        stmt.query_row([id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|_| StatusCode::NOT_FOUND)?
    };

    let bytes = tokio::fs::read(&book.0)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let mime = if book.1 == "EPUB" {
        "application/epub+zip"
    } else if book.1 == "PDF" {
        "application/pdf"
    } else {
        "application/octet-stream"
    };

    Ok((
        [
            (header::CONTENT_TYPE, mime),
            (header::CONTENT_DISPOSITION, "inline"),
        ],
        bytes,
    )
        .into_response())
}

pub async fn start_opds_server(db: Database, port: u16) -> Result<(), String> {
    let state = Arc::new(ServerState { db });
    let app = create_opds_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind OPDS listener on {}: {}", addr, e))?;

    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    Ok(())
}

