import React, { useEffect, useState, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ReaderSettings, BookView } from "../../state/useLibraryStore";
import { Loader2 } from "lucide-react";

interface TxtRendererProps {
  book: BookView;
  settings: ReaderSettings;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  onTocLoaded: (toc: { title: string; pageNumber: number }[]) => void;
  onMouseUp: () => void;
}

export const TxtRenderer: React.FC<TxtRendererProps> = ({
  book,
  settings,
  currentPage,
  onPageChange,
  onTocLoaded,
  onMouseUp,
}) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadText() {
      try {
        setLoading(true);
        const text: string = await invoke("get_book_text", { bookId: book.id });
        if (!isCancelled) {
          setContent(text);
        }
      } catch (err) {
        console.warn("Could not load book text via get_book_text, falling back to description", err);
        if (!isCancelled) {
          setContent(book.description || "No text content available.");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadText();
    return () => {
      isCancelled = true;
    };
  }, [book.id, book.description]);

  // Parse text into structured sections and headings
  const sections = useMemo(() => {
    if (!content) return [];
    const paragraphs = content.split("\n\n");
    const result: Array<{ type: "heading" | "paragraph"; level?: number; text: string; id: string }> = [];
    const toc: { title: string; pageNumber: number }[] = [];

    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (!trimmed) return;

      if (trimmed.startsWith("#")) {
        const hashMatch = trimmed.match(/^#+/);
        const level = hashMatch ? Math.min(6, hashMatch[0].length) : 1;
        const text = trimmed.replace(/^#+\s*/, "");
        const id = `heading-${idx}`;
        result.push({ type: "heading", level, text, id });
        toc.push({ title: text, pageNumber: idx + 1 });
      } else {
        result.push({ type: "paragraph", text: trimmed, id: `p-${idx}` });
      }
    });

    if (toc.length > 0) {
      onTocLoaded(toc);
    }

    return result;
  }, [content, onTocLoaded]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "50vh",
          gap: "12px",
          color: "var(--pk-text-muted)",
        }}
      >
        <Loader2 className="animate-spin" size={28} />
        <p style={{ fontSize: "14px" }}>Reading document text...</p>
      </div>
    );
  }

  const zoomFactor = settings.zoomLevel / 100;
  const baseFontSize = settings.fontSize * zoomFactor;

  return (
    <div
      ref={containerRef}
      onMouseUp={onMouseUp}
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "32px 24px 80px",
        lineHeight: 1.85,
        fontSize: `${baseFontSize}px`,
        textAlign: "justify",
      }}
    >
      {sections.map((sec) => {
        if (sec.type === "heading") {
          return (
            <h2
              key={sec.id}
              id={sec.id}
              style={{
                fontSize: `${baseFontSize * 1.35}px`,
                fontWeight: 700,
                marginTop: "2.5rem",
                marginBottom: "1rem",
                color: "var(--pk-accent-cinnabar)",
                fontFamily: "var(--pk-font-serif)",
                borderBottom: "1px solid var(--pk-border-default)",
                paddingBottom: "8px",
              }}
            >
              {sec.text}
            </h2>
          );
        }
        return (
          <p
            key={sec.id}
            id={sec.id}
            style={{
              marginBottom: "1.4rem",
              textIndent: "1.5em",
            }}
          >
            {sec.text}
          </p>
        );
      })}
    </div>
  );
};
