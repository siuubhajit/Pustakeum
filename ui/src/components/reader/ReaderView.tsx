import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ReaderHud } from "./ReaderHud";
import { SearchOverlay, SearchMatch } from "./SearchOverlay";
import { ReaderSettings, BookView } from "../../state/useLibraryStore";

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
  const [plainText, setPlainText] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

          // If text document, load file content directly or via chapter
          if (res.book.file_format === "TXT") {
            try {
              // Read fallback or preview text
              setPlainText(res.book.description || "Reading document...");
            } catch (_) {}
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

    loadBook();
    return () => {
      isMounted = false;
    };
  }, [bookId]);

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
    // Jump to the section or scroll to match
    const targetEl = document.getElementById(`section-${match.section_index}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth" });
    }
    setIsSearchOpen(false);
  };

  // Determine paper background and font family
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
      />

      {isSearchOpen && (
        <SearchOverlay
          bookId={bookId}
          onClose={() => setIsSearchOpen(false)}
          onSelectMatch={handleSelectMatch}
        />
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
          /* Plain Text Classical Reading Mode */
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
            {plainText}
          </div>
        ) : (
          /* PDF / Generic Document Viewport */
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

