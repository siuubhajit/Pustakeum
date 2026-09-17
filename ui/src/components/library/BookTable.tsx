import React, { useState, useMemo } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { BookView } from "../../state/useLibraryStore";

interface BookTableProps {
  books: BookView[];
  selectedBookId: number | null;
  onSelectBook: (id: number) => void;
  onOpenBook: (book: BookView) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type SortField = "title" | "authors" | "series" | "file_format" | "file_size_bytes" | "progress_percentage";

export const BookTable: React.FC<BookTableProps> = ({
  books,
  selectedBookId,
  onSelectBook,
  onOpenBook,
  searchQuery,
  onSearchChange,
}) => {
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedBooks = useMemo(() => {
    const list = [...books];
    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "title":
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case "authors":
          valA = (a.authors[0] || "").toLowerCase();
          valB = (b.authors[0] || "").toLowerCase();
          break;
        case "series":
          valA = (a.series || "").toLowerCase();
          valB = (b.series || "").toLowerCase();
          break;
        case "file_format":
          valA = a.file_format;
          valB = b.file_format;
          break;
        case "file_size_bytes":
          valA = a.file_size_bytes;
          valB = b.file_size_bytes;
          break;
        case "progress_percentage":
          valA = a.progress_percentage;
          valB = b.progress_percentage;
          break;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [books, sortField, sortAsc]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    }
    return sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="pk-table-container">
      {/* Top Filter & Instant Search Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          borderBottom: "1px solid var(--pk-border-subtle)",
          background: "var(--pk-bg-surface)",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              color: "var(--pk-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search by Title, Author, Series, Tags, or Full Text (SQLite FTS5)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 12px 6px 32px",
              fontSize: "13px",
              borderRadius: "var(--pk-radius-sm)",
              border: "1px solid var(--pk-border-default)",
              background: "var(--pk-bg-base)",
              color: "var(--pk-text-primary)",
              outline: "none",
              fontFamily: "var(--pk-font-sans)",
            }}
          />
        </div>
        <div style={{ fontSize: "12px", color: "var(--pk-text-muted)" }}>
          {books.length} {books.length === 1 ? "document" : "documents"}
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="pk-table-header">
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("title")}
        >
          <span>Title</span>
          {renderSortIcon("title")}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("authors")}
        >
          <span>Authors</span>
          {renderSortIcon("authors")}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("series")}
        >
          <span>Series</span>
          {renderSortIcon("series")}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("file_format")}
        >
          <span>Format</span>
          {renderSortIcon("file_format")}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("file_size_bytes")}
        >
          <span>Size</span>
          {renderSortIcon("file_size_bytes")}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          onClick={() => handleSort("progress_percentage")}
        >
          <span>Progress</span>
          {renderSortIcon("progress_percentage")}
        </div>
      </div>

      {/* Table Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sortedBooks.map((book) => {
          const isSelected = book.id === selectedBookId;
          return (
            <div
              key={book.id}
              className={`pk-table-row ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectBook(book.id)}
              onDoubleClick={() => onOpenBook(book)}
              title="Double click to read in Sumatra-speed reader"
            >
              <span
                style={{
                  fontWeight: isSelected ? 600 : 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingRight: "8px",
                }}
              >
                {book.title}
              </span>
              <span
                style={{
                  color: "var(--pk-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingRight: "8px",
                }}
              >
                {book.authors.join(", ") || "—"}
              </span>
              <span
                style={{
                  color: "var(--pk-accent-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingRight: "8px",
                }}
              >
                {book.series ? `${book.series} #${book.series_index || 1}` : "—"}
              </span>
              <div>
                <span className="pk-badge">{book.file_format}</span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--pk-text-muted)" }}>
                {formatFileSize(book.file_size_bytes)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    flex: 1,
                    height: "5px",
                    background: "var(--pk-border-subtle)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${book.progress_percentage}%`,
                      background: "var(--pk-accent-primary)",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", color: "var(--pk-text-muted)", minWidth: "26px" }}>
                  {Math.round(book.progress_percentage)}%
                </span>
              </div>
            </div>
          );
        })}

        {sortedBooks.length === 0 && (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              color: "var(--pk-text-muted)",
              fontSize: "14px",
            }}
          >
            No documents matched your search query or selected shelf.
          </div>
        )}
      </div>
    </div>
  );
};

