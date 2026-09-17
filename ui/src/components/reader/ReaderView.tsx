import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Trash2, Bookmark, ChevronRight } from "lucide-react";
import { ReaderHud } from "./ReaderHud";
import { SearchOverlay, SearchMatch } from "./SearchOverlay";
import { ReaderSettings, BookView, AnnotationView } from "../../state/useLibraryStore";

interface ReaderViewProps {
  bookId: number;
  settings: ReaderSettings;
  onUpdateSettings: (s: Partial<ReaderSettings>) => void;
  onUpdateProgress: (bookId: number, page: number, pct: number) => void;
}

interface OpenBookContentResponse {
  book: BookView;
  epub_data?: {
    metadata: any;
    chapters: Array<{ id: string; title: string; href: string; content: string }>;
  };
  comic_data?: {
    title: string;
    page_count: number;
    page_names: string[];
  };
  pdf_data?: {
    title: string;
    page_count: number;
  };
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  bookId,
  settings,
  onUpdateSettings,
  onUpdateProgress,
}) => {
  const [content, setContent] = useState<OpenBookContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationView[]>([]);
  const [plainText, setPlainText] = useState<string | null>(null);

  // Floating text selection popover state
  const [selectionRange, setSelectionRange] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load Book Content and Annotations
  useEffect(() => {
    let isMounted = true;

    async function loadBook() {
      try {
        setLoading(true);
        setError(null);
        const res: OpenBookContentResponse = await invoke("open_book_content", { bookId });
        if (isMounted) {
          setContent(res);
          setCurrentPage(res.book.current_page || 1);

          if (res.book.file_format === "TXT") {
            setPlainText(res.book.description || "Reading document...");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.toString() || "Failed to load document");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadAnnotations() {
      try {
        const anns: AnnotationView[] = await invoke("get_book_annotations", { bookId });
        if (isMounted) setAnnotations(anns);
      } catch (err) {
        console.warn("Failed to load annotations:", err);
      }
    }

    loadBook();
    loadAnnotations();
    return () => {
      isMounted = false;
    };
  }, [bookId]);

  // Handle Text Selection for Highlighting & Annotating
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const text = sel.toString().trim();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectionRange({
        text,
        x: rect.left + rect.width / 2,
        y: Math.max(50, rect.top - 40),
      });
    } else {
      setSelectionRange(null);
    }
  };

  const handleCreateHighlight = async (colorHex: string) => {
    if (!selectionRange) return;
    try {
      const newAnn: AnnotationView = await invoke("create_annotation", {
        bookId,
        annotationType: "HIGHLIGHT",
        pageIndex: currentPage,
        selectedText: selectionRange.text,
        noteComment: null,
        colorHex,
      });
      setAnnotations((prev) => [...prev, newAnn]);
      window.getSelection()?.removeAllRanges();
      setSelectionRange(null);
    } catch (err) {
      console.warn("Create highlight error:", err);
    }
  };

  const handleCreateNote = async () => {
    if (!selectionRange) return;
    const comment = prompt("Enter margin note for selection:", "");
    if (comment === null) return;

    try {
      const newAnn: AnnotationView = await invoke("create_annotation", {
        bookId,
        annotationType: "NOTE",
        pageIndex: currentPage,
        selectedText: selectionRange.text,
        noteComment: comment.trim() || null,
        colorHex: "#E5A93C",
      });
      setAnnotations((prev) => [...prev, newAnn]);
      window.getSelection()?.removeAllRanges();
      setSelectionRange(null);
    } catch (err) {
      console.warn("Create note error:", err);
    }
  };

  const handleDeleteAnnotation = async (annId: number) => {
    try {
      await invoke("delete_annotation", { annotationId: annId });
      setAnnotations((prev) => prev.filter((a) => a.id !== annId));
    } catch (err) {
      console.warn("Delete annotation error:", err);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === "j" || e.key === "ArrowDown") {
        containerRef.current?.scrollBy({ top: 120, behavior: "smooth" });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        containerRef.current?.scrollBy({ top: -120, behavior: "smooth" });
      } else if (e.key === " " && !e.shiftKey) {
        e.preventDefault();
        containerRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" });
      } else if (e.key === " " && e.shiftKey) {
        e.preventDefault();
        containerRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: "smooth" });
      } else if (e.key === "+" || e.key === "=") {
        onUpdateSettings({ zoomLevel: Math.min(250, settings.zoomLevel + 10) });
      } else if (e.key === "-") {
        onUpdateSettings({ zoomLevel: Math.max(50, settings.zoomLevel - 10) });
      } else if (e.key === "0") {
        onUpdateSettings({ zoomLevel: 100 });
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsTocOpen(false);
        setIsAnnotationsOpen(false);
        setSelectionRange(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.zoomLevel, onUpdateSettings]);

  // Track scroll position to update reading progress
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    const pct = Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100));
    const totalPages = content?.book.page_count || 1;
    const pageNum = Math.min(totalPages, Math.max(1, Math.round((pct / 100) * totalPages)));
    setCurrentPage(pageNum);

    onUpdateProgress(bookId, pageNum, pct);
  };

  const handleSelectMatch = (match: SearchMatch) => {
    const targetEl = document.getElementById(`section-${match.section_index}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth" });
    }
    setIsSearchOpen(false);
  };

  const getPaperBg = () => {
    if (settings.paperMode === "parchment") return "var(--pk-reader-paper)";
    if (settings.paperMode === "dark") return "var(--pk-bg-base)";
    return "#FFFFFF";
  };

  const getTextColor = () => {
    if (settings.paperMode === "parchment") return "var(--pk-reader-text)";
    if (settings.paperMode === "dark") return "var(--pk-text-primary)";
    return "#111111";
  };

  const getFontFamily = () => {
    if (settings.fontFamily === "sans") return "var(--pk-font-sans)";
    if (settings.fontFamily === "mono") return "var(--pk-font-mono)";
    return "var(--pk-font-serif)";
  };

  if (loading) {
    return (
      <div
        className="pk-reader-viewport"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ fontSize: "14px", color: "var(--pk-text-muted)" }}>
          Loading document with Sumatra-speed pipeline...
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div
        className="pk-reader-viewport"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}
      >
        <div style={{ textAlign: "center", maxWidth: "480px" }}>
          <h3 style={{ marginBottom: "8px", color: "var(--pk-accent-primary)" }}>Document Load Error</h3>
          <p style={{ fontSize: "13px", color: "var(--pk-text-secondary)" }}>{error}</p>
        </div>
      </div>
    );
  }

  const totalPages = content.book.page_count || 1;

  return (
    <div
      ref={containerRef}
      className="pk-reader-viewport"
      onScroll={handleScroll}
      onMouseUp={handleMouseUp}
      style={{
        backgroundColor: getPaperBg(),
        color: getTextColor(),
      }}
    >
      <ReaderHud
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => {
          setCurrentPage(p);
          const el = containerRef.current;
          if (el) {
            const maxScroll = el.scrollHeight - el.clientHeight;
            el.scrollTo({ top: ((p - 1) / totalPages) * maxScroll, behavior: "smooth" });
          }
        }}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        isSearchOpen={isSearchOpen}
        onToggleToc={() => {
          setIsTocOpen(!isTocOpen);
          setIsAnnotationsOpen(false);
        }}
        isTocOpen={isTocOpen}
        onToggleAnnotations={() => {
          setIsAnnotationsOpen(!isAnnotationsOpen);
          setIsTocOpen(false);
        }}
        isAnnotationsOpen={isAnnotationsOpen}
      />

      {/* Floating Highlight / Annotation Popover */}
      {selectionRange && (
        <div
          style={{
            position: "fixed",
            left: `${selectionRange.x}px`,
            top: `${selectionRange.y}px`,
            transform: "translate(-50%, -100%)",
            backgroundColor: "var(--pk-bg-surface)",
            border: "1px solid var(--pk-border-default)",
            borderRadius: "var(--pk-radius-md)",
            boxShadow: "var(--pk-shadow-lg)",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            zIndex: 110,
          }}
        >
          {/* Yellow Highlight */}
          <button
            onClick={() => handleCreateHighlight("#E5A93C")}
            title="Highlight in Gold"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "#E5A93C",
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          />
          {/* Terracotta Highlight */}
          <button
            onClick={() => handleCreateHighlight("#A13D22")}
            title="Highlight in Terracotta"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "#A13D22",
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          />
          {/* Jade Highlight */}
          <button
            onClick={() => handleCreateHighlight("#10B981")}
            title="Highlight in Jade"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "#10B981",
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          />
          <div style={{ width: "1px", height: "14px", background: "var(--pk-border-default)", margin: "0 2px" }} />
          <button
            className="pk-btn"
            style={{ padding: "2px 6px", fontSize: "11px" }}
            onClick={handleCreateNote}
          >
            Add Note
          </button>
        </div>
      )}

      {/* In-Book Search Overlay */}
      {isSearchOpen && (
        <SearchOverlay
          bookId={bookId}
          onClose={() => setIsSearchOpen(false)}
          onSelectMatch={handleSelectMatch}
        />
      )}

      {/* Table of Contents Drawer */}
      {isTocOpen && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: "38px",
            bottom: 0,
            width: "300px",
            backgroundColor: "var(--pk-bg-surface)",
            borderRight: "1px solid var(--pk-border-default)",
            boxShadow: "var(--pk-shadow-lg)",
            zIndex: 90,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--pk-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h4 style={{ fontSize: "14px", fontWeight: 700 }}>Table of Contents</h4>
            <button className="pk-btn-icon" onClick={() => setIsTocOpen(false)}>
              <X size={15} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {content.epub_data?.chapters.map((ch, idx) => (
              <div
                key={ch.id}
                className="pk-shelf-item"
                style={{ padding: "8px 16px" }}
                onClick={() => {
                  const targetEl = document.getElementById(`section-${idx}`);
                  if (targetEl) targetEl.scrollIntoView({ behavior: "smooth" });
                  setIsTocOpen(false);
                }}
              >
                <span style={{ fontSize: "13px" }}>{ch.title}</span>
                <ChevronRight size={13} style={{ opacity: 0.5 }} />
              </div>
            ))}
            {(!content.epub_data || content.epub_data.chapters.length === 0) && (
              <div style={{ padding: "24px 16px", color: "var(--pk-text-muted)", fontSize: "13px" }}>
                Single-section document.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Annotations & Notes Drawer */}
      {isAnnotationsOpen && (
        <div
          style={{
            position: "fixed",
            right: 0,
            top: "38px",
            bottom: 0,
            width: "340px",
            backgroundColor: "var(--pk-bg-surface)",
            borderLeft: "1px solid var(--pk-border-default)",
            boxShadow: "var(--pk-shadow-lg)",
            zIndex: 90,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--pk-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Bookmark size={15} style={{ color: "var(--pk-accent-primary)" }} />
              <h4 style={{ fontSize: "14px", fontWeight: 700 }}>Annotations ({annotations.length})</h4>
            </div>
            <button className="pk-btn-icon" onClick={() => setIsAnnotationsOpen(false)}>
              <X size={15} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {annotations.map((ann) => (
              <div
                key={ann.id}
                style={{
                  padding: "10px",
                  borderRadius: "var(--pk-radius-sm)",
                  background: "var(--pk-bg-elevated)",
                  borderLeft: `4px solid ${ann.color_hex}`,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--pk-text-muted)" }}>
                    Page {ann.page_index || 1} • {ann.annotation_type}
                  </span>
                  <button
                    className="pk-btn-icon"
                    style={{ padding: "2px" }}
                    onClick={() => handleDeleteAnnotation(ann.id)}
                    title="Delete Annotation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {ann.selected_text && (
                  <blockquote
                    style={{
                      fontSize: "12px",
                      fontStyle: "italic",
                      color: "var(--pk-text-primary)",
                      marginBottom: "4px",
                      lineHeight: 1.4,
                    }}
                  >
                    "{ann.selected_text}"
                  </blockquote>
                )}

                {ann.note_comment && (
                  <p style={{ fontSize: "12px", color: "var(--pk-text-secondary)", lineHeight: 1.4 }}>
                    {ann.note_comment}
                  </p>
                )}
              </div>
            ))}

            {annotations.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--pk-text-muted)", fontSize: "13px" }}>
                Select text in the reader to create highlights and margin notes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reader Document Body */}
      <main
        className="pk-reader-content"
        style={{
          fontFamily: getFontFamily(),
          fontSize: `${settings.fontSize}px`,
          transform: `scale(${settings.zoomLevel / 100})`,
          transformOrigin: "top center",
          transition: "font-size var(--pk-transition-fast)",
        }}
      >
        <div style={{ marginBottom: "3rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "2.4em",
              fontFamily: "var(--pk-font-title)",
              marginBottom: "0.5rem",
              lineHeight: 1.2,
            }}
          >
            {content.book.title}
          </h1>
          <p style={{ fontSize: "1.1em", opacity: 0.8, fontWeight: 500 }}>
            {content.book.authors.join(", ") || "Unknown Author"}
          </p>
          {content.book.series && (
            <p style={{ fontSize: "0.9em", color: "var(--pk-accent-secondary)", marginTop: "4px" }}>
              {content.book.series} #{content.book.series_index || 1}
            </p>
          )}
        </div>

        {/* EPUB Document Rendering */}
        {content.epub_data && content.epub_data.chapters.length > 0 ? (
          <div>
            {content.epub_data.chapters.map((chapter, idx) => (
              <section key={chapter.id} id={`section-${idx}`} style={{ marginBottom: "4rem" }}>
                <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
              </section>
            ))}
          </div>
        ) : content.book.file_format === "TXT" ? (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
            {plainText}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div
              style={{
                display: "inline-block",
                padding: "60px 40px",
                border: "1px solid var(--pk-border-default)",
                borderRadius: "var(--pk-radius-md)",
                background: "var(--pk-bg-surface)",
                maxWidth: "600px",
                boxShadow: "var(--pk-shadow-md)",
              }}
            >
              <h2 style={{ fontSize: "1.4em", marginBottom: "12px" }}>{content.book.file_format} Document</h2>
              <p style={{ fontSize: "14px", color: "var(--pk-text-secondary)", marginBottom: "20px" }}>
                File: {content.book.file_path}
              </p>
              <p style={{ fontSize: "13px", lineHeight: 1.6 }}>
                Native zero-copy rasterization pipeline is active for {content.book.page_count} pages.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
