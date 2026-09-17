import React from "react";
import { Book, Bookmark, Layers, Tag, User, Sparkles } from "lucide-react";
import { BookView } from "../../state/useLibraryStore";

interface SidebarProps {
  books: BookView[];
  selectedShelf: {
    type: "all" | "format" | "author" | "series" | "tag";
    value?: string;
  };
  onSelectShelf: (shelf: {
    type: "all" | "format" | "author" | "series" | "tag";
    value?: string;
  }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  books,
  selectedShelf,
  onSelectShelf,
}) => {
  // Aggregate formats
  const formatCounts: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const seriesCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  books.forEach((b) => {
    formatCounts[b.file_format] = (formatCounts[b.file_format] || 0) + 1;
    b.authors.forEach((a) => {
      if (a) authorCounts[a] = (authorCounts[a] || 0) + 1;
    });
    if (b.series) {
      seriesCounts[b.series] = (seriesCounts[b.series] || 0) + 1;
    }
    b.tags.forEach((t) => {
      if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  return (
    <aside className="pk-sidebar" style={{ overflowY: "auto", padding: "10px 0" }}>
      <div style={{ padding: "0 12px 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", letterSpacing: "0.05em" }}>
        Virtual Shelves
      </div>

      <div
        className={`pk-shelf-item ${selectedShelf.type === "all" ? "active" : ""}`}
        onClick={() => onSelectShelf({ type: "all" })}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Book size={14} />
          <span>All Books</span>
        </div>
        <span style={{ fontSize: "11px", opacity: 0.7 }}>{books.length}</span>
      </div>

      {/* Formats Section */}
      <div style={{ marginTop: "14px", padding: "0 12px 4px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", letterSpacing: "0.05em" }}>
        Formats
      </div>
      {Object.entries(formatCounts).map(([fmt, count]) => (
        <div
          key={fmt}
          className={`pk-shelf-item ${
            selectedShelf.type === "format" && selectedShelf.value === fmt ? "active" : ""
          }`}
          onClick={() => onSelectShelf({ type: "format", value: fmt })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={13} />
            <span>{fmt}</span>
          </div>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>{count}</span>
        </div>
      ))}

      {/* Authors Section */}
      <div style={{ marginTop: "14px", padding: "0 12px 4px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", letterSpacing: "0.05em" }}>
        Authors
      </div>
      {Object.entries(authorCounts).slice(0, 8).map(([author, count]) => (
        <div
          key={author}
          className={`pk-shelf-item ${
            selectedShelf.type === "author" && selectedShelf.value === author ? "active" : ""
          }`}
          onClick={() => onSelectShelf({ type: "author", value: author })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            <User size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {author}
            </span>
          </div>
          <span style={{ fontSize: "11px", opacity: 0.7, flexShrink: 0 }}>{count}</span>
        </div>
      ))}

      {/* Series Section */}
      {Object.keys(seriesCounts).length > 0 && (
        <>
          <div style={{ marginTop: "14px", padding: "0 12px 4px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", letterSpacing: "0.05em" }}>
            Series
          </div>
          {Object.entries(seriesCounts).map(([series, count]) => (
            <div
              key={series}
              className={`pk-shelf-item ${
                selectedShelf.type === "series" && selectedShelf.value === series ? "active" : ""
              }`}
              onClick={() => onSelectShelf({ type: "series", value: series })}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                <Bookmark size={13} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {series}
                </span>
              </div>
              <span style={{ fontSize: "11px", opacity: 0.7, flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </>
      )}

      {/* Tags Section */}
      {Object.keys(tagCounts).length > 0 && (
        <>
          <div style={{ marginTop: "14px", padding: "0 12px 4px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", letterSpacing: "0.05em" }}>
            Tags
          </div>
          {Object.entries(tagCounts).slice(0, 10).map(([tag, count]) => (
            <div
              key={tag}
              className={`pk-shelf-item ${
                selectedShelf.type === "tag" && selectedShelf.value === tag ? "active" : ""
              }`}
              onClick={() => onSelectShelf({ type: "tag", value: tag })}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                <Tag size={13} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tag}
                </span>
              </div>
              <span style={{ fontSize: "11px", opacity: 0.7, flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: "auto", padding: "16px 12px 4px", fontSize: "11px", color: "var(--pk-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
        <Sparkles size={13} style={{ color: "var(--pk-accent-secondary)" }} />
        <span>OPDS Feed Active on :8085</span>
      </div>
    </aside>
  );
};

