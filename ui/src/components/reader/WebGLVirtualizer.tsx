import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebGLPageVirtualizer } from "../../renderers/WebGLCanvas";
import { Loader2 } from "lucide-react";

interface WebGLVirtualizerProps {
  bookId: number;
  currentPage: number;
  zoom: number;
  onPageChange?: (page: number) => void;
}

export const WebGLVirtualizer: React.FC<WebGLVirtualizerProps> = ({
  bookId,
  currentPage,
  zoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualizerRef = useRef<WebGLPageVirtualizer | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize WebGL Virtualizer
  useEffect(() => {
    if (!canvasRef.current) return;
    const virt = new WebGLPageVirtualizer(canvasRef.current);
    virtualizerRef.current = virt;

    return () => {
      virt.destroy();
      virtualizerRef.current = null;
    };
  }, []);

  // Fetch page raster buffer and prefetch adjacent pages [P-1, P, P+1]
  useEffect(() => {
    let cancelled = false;

    const loadPage = async (pageIdx: number) => {
      try {
        const response: ArrayBuffer = await invoke("cmd_render_page_rgba", {
          bookId,
          page: pageIdx,
          targetWidth: Math.round(900 * zoom),
          targetHeight: Math.round(1200 * zoom),
        });

        if (cancelled || !response) return;

        const view = new DataView(response);
        const width = view.getUint32(0, true);
        const height = view.getUint32(4, true);
        const rgbaPixels = new Uint8Array(response, 16);

        if (virtualizerRef.current && canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          virtualizerRef.current.uploadPageTexture(pageIdx, width, height, rgbaPixels);
          if (pageIdx === currentPage - 1) {
            virtualizerRef.current.renderPage(pageIdx);
          }
        }
      } catch (err) {
        console.warn(`Failed to render WebGL page ${pageIdx}:`, err);
      }
    };

    const run = async () => {
      setLoading(true);
      const activeIdx = currentPage - 1;

      // 1. Load active visible page first
      await loadPage(activeIdx);
      if (!cancelled) setLoading(false);

      // 2. Asynchronously preload adjacent window [P-1, P+1]
      if (activeIdx > 0) loadPage(activeIdx - 1);
      loadPage(activeIdx + 1);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [bookId, currentPage, zoom]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        overflow: "auto",
        position: "relative",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 10,
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          <span>GPU Rasterizing...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
          borderRadius: 4,
          maxWidth: "100%",
          maxHeight: "100%",
          display: "block",
        }}
      />
    </div>
  );
};

