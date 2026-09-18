import React, { useRef, useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReflowEngineProps {
  content: string;
  fontSize: number;
  fontFamily: string;
  paperMode: "plain" | "bhurjapatra" | "nila-krshna";
  onPageChange?: (current: number, total: number) => void;
}

export const ReflowEngine: React.FC<ReflowEngineProps> = ({
  content,
  fontSize,
  fontFamily,
  paperMode,
  onPageChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Styling based on theme tokens
  const paperStyles = useMemo(() => {
    switch (paperMode) {
      case "bhurjapatra":
        return {
          bg: "#F9F6EE",
          text: "#1A1815",
          border: "rgba(184, 134, 11, 0.15)",
        };
      case "nila-krshna":
        return {
          bg: "#0E1117",
          text: "#E2E8F0",
          border: "rgba(56, 189, 248, 0.2)",
        };
      default:
        return {
          bg: "#FFFFFF",
          text: "#111827",
          border: "rgba(0, 0, 0, 0.1)",
        };
    }
  }, [paperMode]);

  // Recalculate column pages when container sizes or text changes
  useEffect(() => {
    const calcPagination = () => {
      if (!containerRef.current || !contentRef.current) return;
      const scrollWidth = contentRef.current.scrollWidth;
      const clientWidth = containerRef.current.clientWidth;

      const pages = Math.max(1, Math.round(scrollWidth / (clientWidth + 40)));
      setTotalPages(pages);
      onPageChange?.(currentPage, pages);
    };

    const timer = setTimeout(calcPagination, 100);
    window.addEventListener("resize", calcPagination);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calcPagination);
    };
  }, [content, fontSize, fontFamily, currentPage, onPageChange]);

  const goToPage = (p: number) => {
    const target = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(target);
    if (containerRef.current) {
      const offset = (target - 1) * (containerRef.current.clientWidth + 40);
      containerRef.current.scrollTo({ left: offset, behavior: "smooth" });
    }
    onPageChange?.(target, totalPages);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: paperStyles.bg,
        color: paperStyles.text,
        position: "relative",
        userSelect: "text",
      }}
    >
      {/* Horizontal Multi-Column Viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowX: "hidden",
          overflowY: "hidden",
          padding: "40px 60px",
          scrollBehavior: "smooth",
        }}
      >
        <div
          ref={contentRef}
          style={{
            height: "100%",
            columnWidth: "480px",
            columnGap: "40px",
            columnRule: `1px dashed ${paperStyles.border}`,
            fontSize: `${fontSize}px`,
            fontFamily:
              fontFamily === "serif"
                ? "Georgia, 'Times New Roman', serif"
                : fontFamily === "sans"
                ? "Inter, -apple-system, sans-serif"
                : "'Fira Code', monospace",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            textAlign: "justify",
          }}
        >
          {content}
        </div>
      </div>

      {/* Floating Bottom Pagination Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 40px",
          borderTop: `1px solid ${paperStyles.border}`,
          fontSize: 13,
          opacity: 0.85,
        }}
      >
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "inherit",
            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
            opacity: currentPage <= 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <span>
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "inherit",
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
            opacity: currentPage >= totalPages ? 0.4 : 1,
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

