import React, { useState } from "react";
import { X, FileCode, CheckCircle2, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { BookView } from "../../state/useLibraryStore";

interface ConvertModalProps {
  book: BookView;
  onClose: () => void;
}

export const ConvertModal: React.FC<ConvertModalProps> = ({ book, onClose }) => {
  const [targetFormat, setTargetFormat] = useState<string>("Markdown");
  const [converting, setConverting] = useState<boolean>(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    try {
      setConverting(true);
      setError(null);
      setResultPath(null);

      const path: string = await invoke("convert_book_format", {
        bookId: book.id,
        targetFormat,
      });

      setResultPath(path);
    } catch (err: any) {
      if (err !== "Conversion cancelled by user") {
        setError(err?.toString() || "Failed to convert document");
      }
    } finally {
      setConverting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "480px",
          backgroundColor: "var(--pk-bg-surface)",
          border: "1px solid var(--pk-border-default)",
          borderRadius: "var(--pk-radius-lg)",
          boxShadow: "var(--pk-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pk-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileCode size={16} style={{ color: "var(--pk-accent-primary)" }} />
            <h3 style={{ fontSize: "15px", fontWeight: 700 }}>
              Convert Document (AST Engine)
            </h3>
          </div>
          <button className="pk-btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "var(--pk-text-muted)" }}>Source Document</div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{book.title}</div>
            <div style={{ fontSize: "12px", color: "var(--pk-text-secondary)" }}>
              Format: {book.file_format} | Path: {book.file_path}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              Select Output Format:
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {["Markdown", "HTML", "TXT"].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setTargetFormat(fmt)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--pk-radius-sm)",
                    border: "1px solid",
                    borderColor: targetFormat === fmt ? "var(--pk-accent-primary)" : "var(--pk-border-default)",
                    background: targetFormat === fmt ? "var(--pk-accent-subtle)" : "var(--pk-bg-base)",
                    color: targetFormat === fmt ? "var(--pk-accent-primary)" : "var(--pk-text-primary)",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--pk-radius-sm)",
                background: "rgba(225, 29, 72, 0.1)",
                color: "#E11D48",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {resultPath && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--pk-radius-sm)",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10B981",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                <CheckCircle2 size={15} />
                <span>Conversion Complete!</span>
              </div>
              <span style={{ color: "var(--pk-text-primary)", wordBreak: "break-all" }}>
                Saved to: {resultPath}
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" className="pk-btn" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="pk-btn pk-btn-primary"
              disabled={converting}
              onClick={handleConvert}
            >
              {converting ? "Converting AST..." : "Choose Folder & Convert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

