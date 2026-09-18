import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ReaderSettings, BookView } from "../../state/useLibraryStore";
import { Loader2, AlertCircle } from "lucide-react";

interface ComicRendererProps {
  book: BookView;
  comicData: {
    title: string;
    page_count: number;
    page_names: string[];
  };
  currentPage: number;
  settings: ReaderSettings;
  onPageChange: (newPage: number) => void;
}

export const ComicRenderer: React.FC<ComicRendererProps> = ({
  book,
  comicData,
  currentPage,
  settings,
  onPageChange,
}) => {
  const [pageImages, setPageImages] = useState<{ [pageIndex: number]: string }>({});
  const [loadingPages, setLoadingPages] = useState<{ [pageIndex: number]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);

  // Function to load a specific page image
  const loadPageImage = async (pageIdx: number) => {
    if (pageImages[pageIdx] || loadingPages[pageIdx]) return;

    try {
      setLoadingPages((prev) => ({ ...prev, [pageIdx]: true }));
      const b64: string = await invoke("get_cbz_page", {
        filePath: book.file_path,
        pageIndex: pageIdx,
      });
      setPageImages((prev) => ({ ...prev, [pageIdx]: b64 }));
    } catch (err: any) {
      console.warn(`Failed to extract comic page ${pageIdx}:`, err);
    } finally {
      setLoadingPages((prev) => ({ ...prev, [pageIdx]: false }));
    }
  };

  // Load current page and preload adjacent pages
  useEffect(() => {
    const pageIdx = currentPage - 1; // 0-indexed
    loadPageImage(pageIdx);
    if (pageIdx > 0) loadPageImage(pageIdx - 1);
    if (pageIdx < comicData.page_count - 1) loadPageImage(pageIdx + 1);
  }, [currentPage, book.file_path, comicData.page_count]);

  // Handle scroll to page
  useEffect(() => {
    const targetEl = pageRefs.current.get(currentPage);
    if (targetEl && containerRef.current) {
      isScrollingRef.current = true;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const timer = setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // Observer for page change on scroll
  useEffect(() => {
    const scrollRoot = containerRef.current?.closest(".pk-reader-viewport") || null;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isScrollingRef.current) {
            const pageNum = Number(entry.target.getAttribute("data-page-number"));
            onPageChange(pageNum);
          }
        });
      },
      { root: scrollRoot, threshold: 0.5 }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [comicData.page_count, onPageChange]);

  const zoomFactor = settings.zoomLevel / 100;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "32px",
        padding: "24px 0",
      }}
    >
      {Array.from({ length: comicData.page_count }, (_, i) => i + 1).map((pageNum) => {
        const pageIdx = pageNum - 1;
        const imgUrl = pageImages[pageIdx];
        const isLoading = loadingPages[pageIdx];

        return (
          <div
            key={pageNum}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNum, el);
              else pageRefs.current.delete(pageNum);
            }}
            data-page-number={pageNum}
            style={{
              position: "relative",
              minHeight: "500px",
              minWidth: "350px",
              maxWidth: `${800 * zoomFactor}px`,
              width: `${100 * zoomFactor}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--pk-bg-surface)",
              border: "1px solid var(--pk-border-default)",
              borderRadius: "var(--pk-radius-sm)",
              boxShadow: "var(--pk-shadow-md)",
              overflow: "hidden",
            }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={`Page ${pageNum}`}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--pk-text-muted)",
                }}
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : null}
                <span style={{ fontSize: "12px" }}>Page {pageNum}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

