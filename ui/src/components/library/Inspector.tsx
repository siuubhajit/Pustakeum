import React from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { BookOpen, Edit3, Trash2, Tag, Calendar, Building, Hash } from "lucide-react";
import { BookView } from "../../state/useLibraryStore";

const resolveCoverSrc = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("asset:")) {
    return path;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
};

interface InspectorProps {
  book: BookView | null;
  onOpenBook: (book: BookView) => void;
  onEditMetadata: () => void;
  onDeleteBook: (id: number) => void;
  onRevealInExplorer: (filePath: string) => void;
  onConvertBook: (book: BookView) => void;
  onOpenEpubEditor?: (book: BookView) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  book,
  onOpenBook,
  onEditMetadata,
  onDeleteBook,
  onRevealInExplorer,
  onConvertBook,
  onOpenEpubEditor,
}) => {
  const [coverError, setCoverError] = React.useState(false);

  React.useEffect(() => {
    setCoverError(false);
  }, [book?.id]);

  if (!book) {
    return (
      <div
        className="pk-inspector"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--pk-text-muted)",
          fontSize: "13px",
        }}
      >
        Select a document to inspect metadata
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="pk-inspector">
      {/* Cover Image */}
      <div className="pk-cover-frame">
        {book.cover_image_path && !coverError ? (
          <img
            src={resolveCoverSrc(book.cover_image_path)}
            alt={book.title}
            onError={() => setCoverError(true)}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              color: "var(--pk-text-muted)",
              textAlign: "center",
              padding: "16px",
            }}
          >
            <span style={{ fontSize: "32px", fontFamily: "var(--pk-font-title)" }}>
              {book.title.slice(0, 2).toUpperCase()}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{book.file_format} DOCUMENT</span>
          </div>
        )}
      </div>

      {/* Primary Actions */}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          className="pk-btn pk-btn-primary"
          style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}
          onClick={() => onOpenBook(book)}
        >
          <BookOpen size={15} />
          <span>Read Document</span>
        </button>
        <button
          className="pk-btn"
          style={{ padding: "8px 10px" }}
          onClick={onEditMetadata}
          title="Edit Book Metadata (Calibre style)"
        >
          <Edit3 size={15} />
        </button>
        <button
          className="pk-btn"
          style={{ padding: "8px 10px", color: "var(--pk-text-muted)" }}
          onClick={() => onDeleteBook(book.id)}
          title="Delete Book from Library"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Secondary Industrial Tools */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <button
          className="pk-btn"
          style={{ flex: 1, justifyContent: "center", fontSize: "12px", padding: "6px 8px" }}
          onClick={() => onRevealInExplorer(book.file_path)}
          title="Reveal File in Explorer / Finder"
        >
          <span>Reveal File</span>
        </button>
        <button
          className="pk-btn"
          style={{ flex: 1, justifyContent: "center", fontSize: "12px", padding: "6px 8px" }}
          onClick={() => onConvertBook(book)}
          title="Convert to Markdown, HTML, or TXT via AST"
        >
          <span>Convert Format</span>
        </button>
        {book.file_format === "EPUB" && onOpenEpubEditor && (
          <button
            className="pk-btn"
            style={{ width: "100%", justifyContent: "center", fontSize: "12px", padding: "6px 8px", background: "rgba(229, 169, 60, 0.12)", color: "#E5A93C", borderColor: "rgba(229, 169, 60, 0.3)" }}
            onClick={() => onOpenEpubEditor(book)}
            title="Open Live EPUB Split-Pane Code & Layout Editor"
          >
            <span>EPUB Code & Layout Editor</span>
          </button>
        )}
      </div>

      {/* Book Title & Authors */}
      <div>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 700,
            lineHeight: 1.3,
            color: "var(--pk-text-primary)",
            marginBottom: "4px",
          }}
        >
          {book.title}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--pk-text-secondary)", fontWeight: 500 }}>
          {book.authors.join(", ") || "Unknown Author"}
        </p>
        {book.series && (
          <p style={{ fontSize: "12px", color: "var(--pk-accent-secondary)", marginTop: "2px" }}>
            Series: {book.series} #{book.series_index || 1}
          </p>
        )}
      </div>

      {/* Tags */}
      {book.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {book.tags.map((t) => (
            <span key={t} className="pk-badge" style={{ fontSize: "10px" }}>
              <Tag size={10} style={{ display: "inline", marginRight: "3px" }} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ height: "1px", background: "var(--pk-border-subtle)" }} />

      {/* Structured Details Matrix */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--pk-text-muted)" }}>Format</span>
          <span style={{ fontWeight: 600 }}>{book.file_format}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--pk-text-muted)" }}>File Size</span>
          <span>{formatFileSize(book.file_size_bytes)}</span>
        </div>
        {book.publisher && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--pk-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Building size={12} /> Publisher
            </span>
            <span style={{ textAlign: "right", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {book.publisher}
            </span>
          </div>
        )}
        {book.publication_year && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--pk-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Calendar size={12} /> Year
            </span>
            <span>{book.publication_year}</span>
          </div>
        )}
        {book.isbn && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--pk-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Hash size={12} /> ISBN
            </span>
            <span className="pk-mono">{book.isbn}</span>
          </div>
        )}
      </div>

      {/* Synopsis / Description */}
      {book.description && (
        <>
          <div style={{ height: "1px", background: "var(--pk-border-subtle)" }} />
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--pk-text-muted)", marginBottom: "6px" }}>
              Synopsis
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--pk-text-secondary)",
                lineHeight: 1.6,
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {book.description}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

