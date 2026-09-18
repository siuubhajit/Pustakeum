import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  BookOpen,
  Edit3,
  RefreshCw,
  FolderOpen,
  Trash2,
  BookMarked,
} from "lucide-react";
import { BookView } from "../../state/useLibraryStore";
import { convertFileSrc } from "@tauri-apps/api/core";

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

interface BookGridProps {
  books: BookView[];
  selectedBookId: number | null;
  onSelectBook: (id: number) => void;
  onOpenBook: (book: BookView) => void;
  onEditMetadata?: (book: BookView) => void;
  onDeleteBook?: (id: number) => void;
  onRevealInExplorer?: (filePath: string) => void;
  onConvertBook?: (book: BookView) => void;
}

export const BookGrid: React.FC<BookGridProps> = ({
  books,
  selectedBookId,
  onSelectBook,
  onOpenBook,
  onEditMetadata,
  onDeleteBook,
  onRevealInExplorer,
  onConvertBook,
}) => {
  const [activeMenuBookId, setActiveMenuBookId] = useState<number | null>(null);
  const [failedCovers, setFailedCovers] = useState<Set<number>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuBookId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (books.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--pk-text-muted)",
          padding: "48px",
          gap: "12px",
        }}
      >
        <BookMarked size={40} style={{ opacity: 0.4 }} />
        <p style={{ fontSize: "14px" }}>No documents found in this view.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 28px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "24px 20px",
        alignContent: "start",
      }}
    >
      {books.map((book) => {
        const isSelected = selectedBookId === book.id;
        const isMenuOpen = activeMenuBookId === book.id;

        return (
          <div
            key={book.id}
            onClick={() => onSelectBook(book.id)}
            onDoubleClick={() => onOpenBook(book)}
            style={{
              display: "flex",
              flexDirection: "column",
              cursor: "pointer",
              userSelect: "none",
              borderRadius: "var(--pk-radius-md)",
              padding: "8px",
              transition: "transform var(--pk-transition-fast), background var(--pk-transition-fast)",
              background: isSelected ? "var(--pk-bg-active)" : "transparent",
              border: isSelected
                ? "1px solid var(--pk-accent-primary)"
                : "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = "var(--pk-bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Book Cover Frame */}
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "3 / 4.2",
                borderRadius: "6px",
                overflow: "hidden",
                boxShadow: isSelected
                  ? "0 4px 16px rgba(229, 169, 60, 0.25)"
                  : "0 2px 8px rgba(0, 0, 0, 0.15)",
                background: "var(--pk-bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              {book.cover_image_path && !failedCovers.has(book.id) ? (
                <img
                  src={resolveCoverSrc(book.cover_image_path)}
                  alt={book.title}
                  onError={() => setFailedCovers((prev) => new Set(prev).add(book.id))}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                /* Elegant Classical Procedural Cover */
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(145deg, var(--pk-bg-surface), var(--pk-bg-elevated))",
                    border: "1px solid var(--pk-border-default)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "16px 12px",
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      borderBottom: "1px solid var(--pk-border-subtle)",
                      paddingBottom: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      color: "var(--pk-accent-secondary)",
                    }}
                  >
                    PUSTAKEUM
                  </div>
                  <div>
                    <h4
                      style={{
                        fontSize: "13px",
                        fontFamily: "var(--pk-font-serif)",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        color: "var(--pk-text-primary)",
                        marginBottom: "6px",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {book.title}
                    </h4>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--pk-text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {book.authors.join(", ") || "Classical Text"}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: "var(--pk-text-muted)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {book.file_format}
                  </div>
                </div>
              )}

              {/* Progress Indicator Bar */}
              {book.progress_percentage > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "rgba(0, 0, 0, 0.3)",
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
              )}
            </div>

            {/* Book Title */}
            <div
              title={book.title}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--pk-text-primary)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "3px",
              }}
            >
              {book.title}
            </div>

            {/* Book Authors */}
            <div
              title={book.authors.join(", ")}
              style={{
                fontSize: "11.5px",
                color: "var(--pk-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "8px",
              }}
            >
              {book.authors.length > 0 ? book.authors.join(", ") : "Unknown Author"}
            </div>

            {/* Bottom Row: Format Chip & Action Menu Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {/* Format Badge */}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  border: "1px solid var(--pk-border-default)",
                  color: "var(--pk-text-secondary)",
                  background: "var(--pk-bg-surface)",
                  letterSpacing: "0.5px",
                }}
              >
                {book.file_format}
              </span>

              {/* Three-Dot Context Button */}
              <button
                className="pk-btn-icon"
                style={{ padding: "4px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuBookId(isMenuOpen ? null : book.id);
                }}
                title="Book Options"
              >
                <MoreVertical size={15} style={{ color: "var(--pk-text-muted)" }} />
              </button>

              {/* Context Dropdown Menu */}
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: "28px",
                    width: "180px",
                    backgroundColor: "var(--pk-bg-surface)",
                    border: "1px solid var(--pk-border-default)",
                    borderRadius: "var(--pk-radius-sm)",
                    boxShadow: "var(--pk-shadow-lg)",
                    zIndex: 60,
                    padding: "4px 0",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
                    className="pk-dropdown-item"
                    onClick={() => {
                      onOpenBook(book);
                      setActiveMenuBookId(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 12px",
                      fontSize: "12px",
                      border: "none",
                      background: "transparent",
                      color: "var(--pk-text-primary)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <BookOpen size={13} style={{ color: "var(--pk-accent-primary)" }} />
                    <span>Open Reader</span>
                  </button>

                  {onEditMetadata && (
                    <button
                      className="pk-dropdown-item"
                      onClick={() => {
                        onEditMetadata(book);
                        setActiveMenuBookId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 12px",
                        fontSize: "12px",
                        border: "none",
                        background: "transparent",
                        color: "var(--pk-text-primary)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Edit Metadata</span>
                    </button>
                  )}

                  {onConvertBook && (
                    <button
                      className="pk-dropdown-item"
                      onClick={() => {
                        onConvertBook(book);
                        setActiveMenuBookId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 12px",
                        fontSize: "12px",
                        border: "none",
                        background: "transparent",
                        color: "var(--pk-text-primary)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw size={13} />
                      <span>Convert Format...</span>
                    </button>
                  )}

                  {onRevealInExplorer && (
                    <button
                      className="pk-dropdown-item"
                      onClick={() => {
                        onRevealInExplorer(book.file_path);
                        setActiveMenuBookId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 12px",
                        fontSize: "12px",
                        border: "none",
                        background: "transparent",
                        color: "var(--pk-text-primary)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <FolderOpen size={13} />
                      <span>Reveal in Explorer</span>
                    </button>
                  )}

                  {onDeleteBook && (
                    <>
                      <div
                        style={{
                          height: "1px",
                          background: "var(--pk-border-subtle)",
                          margin: "4px 0",
                        }}
                      />
                      <button
                        className="pk-dropdown-item"
                        onClick={() => {
                          onDeleteBook(book.id);
                          setActiveMenuBookId(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "7px 12px",
                          fontSize: "12px",
                          border: "none",
                          background: "transparent",
                          color: "#E11D48",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Remove Book</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

