import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Check, Copy, AlertCircle, Layers } from "lucide-react";

interface AnkiModalProps {
  initialText: string;
  sourceTitle: string;
  pageNumber?: number;
  onClose: () => void;
}

export const AnkiModal: React.FC<AnkiModalProps> = ({
  initialText,
  sourceTitle,
  pageNumber,
  onClose,
}) => {
  const [deckName, setDeckName] = useState("Pustakeum Reading");
  const [clozeText, setClozeText] = useState(`{{c1::${initialText}}}`);
  const [backText, setBackText] = useState(`Source: ${sourceTitle} (Page ${pageNumber || 1})`);
  const [tags, setTags] = useState("pustakeum reading classical");
  const [status, setStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus(null);
    try {
      const message: string = await invoke("cmd_sync_anki_card", {
        deckName,
        card: {
          front_text: clozeText,
          back_text: backText,
          cloze_text: clozeText,
          source_title: sourceTitle,
          page_number: pageNumber || 1,
          tags: tags.split(" ").filter((t) => t.trim().length > 0),
        },
      });
      setStatus(message);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setStatus(`Error: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
      }}
    >
      <div
        style={{
          backgroundColor: "#161B22",
          color: "#E2E8F0",
          border: "1px solid #30363D",
          borderRadius: 8,
          width: 500,
          maxWidth: "90vw",
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={20} color="#E5A93C" />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Anki Flashcard Sync Bridge</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Deck Name */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#8B949E", marginBottom: 4 }}>
            Anki Deck Name
          </label>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0D1117",
              color: "#fff",
              border: "1px solid #30363D",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
        </div>

        {/* Cloze Deletion Field */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#8B949E", marginBottom: 4 }}>
            Card Text (Cloze Deletion syntax: <code>&#123;&#123;c1::answer&#125;&#125;</code>)
          </label>
          <textarea
            rows={4}
            value={clozeText}
            onChange={(e) => setClozeText(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0D1117",
              color: "#fff",
              border: "1px solid #30363D",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "'Fira Code', monospace",
              resize: "vertical",
            }}
          />
        </div>

        {/* Extra Notes & Reference */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#8B949E", marginBottom: 4 }}>
            Context & Reference Snippet
          </label>
          <input
            type="text"
            value={backText}
            onChange={(e) => setBackText(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0D1117",
              color: "#fff",
              border: "1px solid #30363D",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
        </div>

        {/* Tags */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#8B949E", marginBottom: 4 }}>
            Tags (space separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0D1117",
              color: "#fff",
              border: "1px solid #30363D",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
        </div>

        {/* Status indicator */}
        {status && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: status.startsWith("Error") ? "rgba(248, 81, 73, 0.15)" : "rgba(63, 185, 80, 0.15)",
              color: status.startsWith("Error") ? "#F85149" : "#3FB950",
            }}
          >
            {status.startsWith("Error") ? <AlertCircle size={14} /> : <Check size={14} />}
            <span>{status}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#21262D",
              color: "#E2E8F0",
              border: "1px solid #30363D",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            style={{
              padding: "8px 16px",
              background: "#E5A93C",
              color: "#161B22",
              fontWeight: 600,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Copy size={15} />
            {isSyncing ? "Syncing..." : "Sync to Anki"}
          </button>
        </div>
      </div>
    </div>
  );
};

