import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { invoke } from "@tauri-apps/api/core";
import { ReaderSettings, AnnotationView } from "../../state/useLibraryStore";
import { Loader2, AlertCircle } from "lucide-react";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfTocItem {
  title: string;
  pageNumber: number;
}

interface PdfRendererProps {
  bookId: number;
  currentPage: number;
  settings: ReaderSettings;
  annotations?: AnnotationView[];
  onPageChange: (newPage: number) => void;
  onTotalPagesLoaded: (totalPages: number) => void;
  onTocLoaded: (toc: PdfTocItem[]) => void;
  onMouseUp: () => void;
}

export const PdfRenderer: React.FC<PdfRendererProps> = ({
  bookId,
  currentPage,
  settings,
  annotations = [],
  onPageChange,
  onTotalPagesLoaded,
  onTocLoaded,
  onMouseUp,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1.414); // Default A4 ratio

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const renderingPagesRef = useRef<Set<number>>(new Set());
  const isScrollingToPage = useRef<boolean>(false);

  // Apply highlight annotations to text layer spans
  const applyAnnotationsToPageEl = useCallback(
    (pageEl: HTMLElement, pageNumber: number, anns: AnnotationView[]) => {
      const pageAnns = anns.filter(
        (a) => (a.page_index || 1) === pageNumber && a.selected_text && a.selected_text.trim().length > 0
      );
      const textLayerEl = pageEl.querySelector(".textLayer");
      if (!textLayerEl) return;

      const spans = Array.from(textLayerEl.querySelectorAll("span")) as HTMLElement[];
      spans.forEach((span) => {
        span.style.backgroundColor = "";
        span.style.borderRadius = "";
        span.style.boxShadow = "";
      });

      if (pageAnns.length === 0) return;

      for (const ann of pageAnns) {
        if (!ann.selected_text) continue;
        const cleanAnn = ann.selected_text.trim().toLowerCase();
        for (const span of spans) {
          const spanText = (span.textContent || "").trim().toLowerCase();
          if (spanText.length > 1 && (cleanAnn.includes(spanText) || spanText.includes(cleanAnn))) {
            span.style.backgroundColor = `${ann.color_hex}4D`; // 30% translucent tint
            span.style.borderRadius = "2px";
            span.style.boxShadow = `0 0 0 1px ${ann.color_hex}66`;
          }
        }
      }
    },
    []
  );

  // 1. Fetch PDF binary data from native backend and load with PDF.js
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const rawData: any = await invoke("get_book_binary", { bookId });
        if (isCancelled) return;

        let uint8Array: Uint8Array;
        if (rawData instanceof Uint8Array) {
          uint8Array = rawData;
        } else if (rawData instanceof ArrayBuffer) {
          uint8Array = new Uint8Array(rawData);
        } else if (Array.isArray(rawData)) {
          uint8Array = new Uint8Array(rawData);
        } else if (rawData && typeof rawData === "object" && "buffer" in rawData) {
          uint8Array = new Uint8Array(rawData.buffer);
        } else {
          throw new Error("Invalid binary data received for PDF");
        }

        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          cMapUrl: "https://unpkg.com/pdfjs-dist@6.3.289/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        const count = doc.numPages;
        setTotalPages(count);
        onTotalPagesLoaded(count);

        // Detect aspect ratio from page 1
        try {
          const p1 = await doc.getPage(1);
          const vp = p1.getViewport({ scale: 1.0 });
          if (vp.width > 0 && vp.height > 0) {
            setAspectRatio(vp.height / vp.width);
          }
        } catch (e) {
          console.warn("Could not determine page aspect ratio:", e);
        }

        // Extract PDF Outline (Bookmarks / Table of Contents)
        try {
          const outline = await doc.getOutline();
          if (outline && outline.length > 0) {
            const parsedToc: PdfTocItem[] = [];
            for (const item of outline) {
              let pageNum = 1;
              if (item.dest) {
                let dest: any = item.dest;
                if (typeof dest === "string") {
                  dest = await doc.getDestination(dest);
                }
                if (dest && Array.isArray(dest) && dest[0]) {
                  const pageIndex = await doc.getPageIndex(dest[0]);
                  pageNum = pageIndex + 1;
                }
              }
              parsedToc.push({
                title: item.title || "Section",
                pageNumber: pageNum,
              });
            }
            onTocLoaded(parsedToc);
          }
        } catch (e) {
          console.warn("Could not extract PDF outline:", e);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("PDF loading error:", err);
          setError(err?.message || "Failed to load and render PDF document");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      renderTasksRef.current.forEach((task) => {
        try {
          task.cancel();
        } catch (e) {
          // ignore
        }
      });
      renderTasksRef.current.clear();
      renderingPagesRef.current.clear();
    };
  }, [bookId]);

  // 2. Render individual page canvas and native transparent text layer
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (!pdfDoc) return;
      const pageEl = pageRefs.current.get(pageNumber);
      if (!pageEl) return;

      const currentScaleKey = `${settings.zoomLevel}_${settings.paperMode}`;

      // Skip if already rendered for this scale key
      if (pageEl.getAttribute("data-rendered-scale") === currentScaleKey) {
        return;
      }

      // Skip duplicate concurrent render on same page
      if (renderingPagesRef.current.has(pageNumber)) {
        return;
      }

      // Cancel any ongoing render task for this page
      const previousTask = renderTasksRef.current.get(pageNumber);
      if (previousTask) {
        try {
          previousTask.cancel();
        } catch (e) {
          // ignore
        }
        renderTasksRef.current.delete(pageNumber);
      }

      renderingPagesRef.current.add(pageNumber);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        const dpr = Math.max(window.devicePixelRatio || 1, 1.5);
        const zoom = settings.zoomLevel / 100;

        const displayViewport = page.getViewport({ scale: zoom });
        const canvasViewport = page.getViewport({ scale: zoom * dpr });

        const cssWidth = Math.floor(displayViewport.width);
        const cssHeight = Math.floor(displayViewport.height);

        // Update container dimensions
        pageEl.style.width = `${cssWidth}px`;
        pageEl.style.height = `${cssHeight}px`;

        // Remove placeholder skeleton
        const placeholder = pageEl.querySelector(".pk-pdf-placeholder");
        if (placeholder) {
          placeholder.remove();
        }

        // Setup canvas
        let canvas = pageEl.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.style.position = "absolute";
          canvas.style.top = "0";
          canvas.style.left = "0";
          canvas.style.display = "block";
          canvas.style.pointerEvents = "none";
          pageEl.appendChild(canvas);
        }

        canvas.width = Math.floor(canvasViewport.width);
        canvas.height = Math.floor(canvasViewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        // Paper mode filters
        if (settings.paperMode === "dark") {
          canvas.style.filter = "invert(0.92) hue-rotate(180deg) contrast(1.05)";
        } else if (settings.paperMode === "parchment") {
          canvas.style.filter = "sepia(0.20) contrast(1.02)";
        } else {
          canvas.style.filter = "none";
        }

        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          const renderTask = (page.render as any)({
            canvasContext: ctx,
            viewport: canvasViewport,
          });
          renderTasksRef.current.set(pageNumber, renderTask);

          try {
            await renderTask.promise;
          } catch (renderErr: any) {
            if (renderErr?.name === "RenderingCancelledException") {
              return;
            }
            throw renderErr;
          }
        }

        // Remove old textLayer
        const oldTextLayer = pageEl.querySelector(".textLayer");
        if (oldTextLayer) {
          oldTextLayer.remove();
        }

        // Render official PDF.js TextLayer with transparent text
        try {
          const textContent = await page.getTextContent();
          if (textContent && textContent.items.length > 0) {
            const textLayerDiv = document.createElement("div");
            textLayerDiv.className = "textLayer";
            textLayerDiv.style.width = `${cssWidth}px`;
            textLayerDiv.style.height = `${cssHeight}px`;
            textLayerDiv.style.setProperty("--total-scale-factor", String(displayViewport.scale));
            textLayerDiv.style.setProperty("--scale-round-x", "1px");
            textLayerDiv.style.setProperty("--scale-round-y", "1px");

            const textLayer = new (pdfjsLib as any).TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport: displayViewport,
            });

            await textLayer.render();
            pageEl.appendChild(textLayerDiv);

            // Apply persistent highlight annotations to text layer
            applyAnnotationsToPageEl(pageEl, pageNumber, annotations);
          }
        } catch (textErr) {
          console.warn(`Text layer rendering warning for page ${pageNumber}:`, textErr);
        }

        pageEl.setAttribute("data-rendered-scale", currentScaleKey);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn(`Error rendering page ${pageNumber}:`, err);
        }
      } finally {
        renderingPagesRef.current.delete(pageNumber);
        renderTasksRef.current.delete(pageNumber);
      }
    },
    [pdfDoc, settings.zoomLevel, settings.paperMode, annotations, applyAnnotationsToPageEl]
  );

  // 3. Immediately render initial pages upon document load
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    const p = Math.max(1, Math.min(currentPage, totalPages));
    renderPage(p);
    if (p < totalPages) renderPage(p + 1);
    if (p > 1) renderPage(p - 1);
  }, [pdfDoc, totalPages, renderPage, currentPage]);

  // 4. Lazy render visible pages with IntersectionObserver
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    const scrollContainer = containerRef.current?.closest(".pk-reader-viewport") as HTMLElement | null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute("data-page-number"));
            if (!isNaN(pageNum) && pageNum > 0) {
              renderPage(pageNum);
              if (pageNum < totalPages) renderPage(pageNum + 1);
              if (pageNum > 1) renderPage(pageNum - 1);

              if (!isScrollingToPage.current) {
                onPageChange(pageNum);
              }
            }
          }
        });
      },
      {
        root: scrollContainer || null,
        rootMargin: "600px 0px 600px 0px",
        threshold: 0.01,
      }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [pdfDoc, totalPages, renderPage, onPageChange]);

  // 5. Programmatic page changes (from HUD, Table of Contents, or bookmarks)
  useEffect(() => {
    if (!pdfDoc || currentPage < 1 || currentPage > totalPages) return;
    const targetEl = pageRefs.current.get(currentPage);
    if (targetEl) {
      isScrollingToPage.current = true;
      renderPage(currentPage);
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const timer = setTimeout(() => {
        isScrollingToPage.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, pdfDoc, totalPages, renderPage]);

  // 6. Re-render visible pages when zoom or paperMode changes
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    pageRefs.current.forEach((el) => {
      el.removeAttribute("data-rendered-scale");
    });

    renderPage(currentPage);
    if (currentPage < totalPages) renderPage(currentPage + 1);
    if (currentPage > 1) renderPage(currentPage - 1);
  }, [settings.zoomLevel, settings.paperMode, renderPage, currentPage, totalPages, pdfDoc]);

  // 7. Update annotations on rendered pages when annotations change
  useEffect(() => {
    pageRefs.current.forEach((pageEl, pageNum) => {
      if (pageEl.getAttribute("data-rendered-scale")) {
        applyAnnotationsToPageEl(pageEl, pageNum, annotations);
      }
    });
  }, [annotations, applyAnnotationsToPageEl]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: "12px",
          color: "var(--pk-text-muted)",
        }}
      >
        <Loader2 className="animate-spin" size={32} />
        <p style={{ fontSize: "14px" }}>Loading PDF document into memory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: "12px",
          color: "var(--pk-accent-terracotta)",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <AlertCircle size={36} />
        <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Failed to Render PDF</h3>
        <p style={{ fontSize: "13px", color: "var(--pk-text-secondary)", maxWidth: "480px" }}>{error}</p>
      </div>
    );
  }

  const zoomFactor = settings.zoomLevel / 100;
  const initialWidth = Math.round(800 * zoomFactor);
  const initialHeight = Math.round(initialWidth * aspectRatio);

  return (
    <div
      ref={containerRef}
      onMouseUp={onMouseUp}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        padding: "20px 0 60px",
      }}
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          ref={(el) => {
            if (el) pageRefs.current.set(pageNum, el);
            else pageRefs.current.delete(pageNum);
          }}
          data-page-number={pageNum}
          className="pk-pdf-page"
          style={{
            width: `${initialWidth}px`,
            minHeight: `${initialHeight}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: settings.paperMode === "dark" ? "#111622" : "#FFFFFF",
          }}
        >
          {/* Skeleton placeholder while page canvas rasterizes */}
          <div
            className="pk-pdf-placeholder"
            style={{
              fontSize: "13px",
              color: "var(--pk-text-muted)",
              letterSpacing: "0.05em",
              userSelect: "none",
            }}
          >
            Page {pageNum}
          </div>
        </div>
      ))}
    </div>
  );
};
