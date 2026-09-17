import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  BookOpen,
  Sun,
  Moon,
  Type,
} from "lucide-react";
import { ReaderSettings } from "../../state/useLibraryStore";

interface ReaderHudProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  settings: ReaderSettings;
  onUpdateSettings: (s: Partial<ReaderSettings>) => void;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
}

export const ReaderHud: React.FC<ReaderHudProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  settings,
  onUpdateSettings,
  onToggleSearch,
  isSearchOpen,
}) => {
  return (
    <div className="pk-micro-hud">
      {/* Page Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <button
          className="pk-btn-icon"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          title="Previous Page (k or Up Arrow)"
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: "12px", fontWeight: 600, padding: "0 4px", minWidth: "50px", textAlign: "center" }}>
          {currentPage} / {totalPages || 1}
        </span>
        <button
          className="pk-btn-icon"
          onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
          disabled={currentPage >= totalPages}
          title="Next Page (j or Down Arrow)"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ width: "1px", height: "16px", background: "var(--pk-border-default)" }} />

      {/* Zoom Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <button
          className="pk-btn-icon"
          onClick={() => onUpdateSettings({ zoomLevel: Math.max(50, settings.zoomLevel - 10) })}
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>
        <span
          style={{ fontSize: "11px", fontWeight: 600, minWidth: "36px", textAlign: "center", cursor: "pointer" }}
          onClick={() => onUpdateSettings({ zoomLevel: 100 })}
          title="Reset Zoom (0)"
        >
          {settings.zoomLevel}%
        </span>
        <button
          className="pk-btn-icon"
          onClick={() => onUpdateSettings({ zoomLevel: Math.min(250, settings.zoomLevel + 10) })}
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      <div style={{ width: "1px", height: "16px", background: "var(--pk-border-default)" }} />

      {/* Paper Surface Mode */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <button
          className={`pk-btn-icon ${settings.paperMode === "parchment" ? "active" : ""}`}
          onClick={() => onUpdateSettings({ paperMode: "parchment" })}
          title="Bhurjapatra Warm Parchment"
          style={{
            background: settings.paperMode === "parchment" ? "var(--pk-bg-active)" : "transparent",
            color: settings.paperMode === "parchment" ? "var(--pk-accent-primary)" : "inherit",
          }}
        >
          <BookOpen size={14} />
        </button>
        <button
          className={`pk-btn-icon ${settings.paperMode === "dark" ? "active" : ""}`}
          onClick={() => onUpdateSettings({ paperMode: "dark" })}
          title="Nila-Krshna Dark Inversion"
          style={{
            background: settings.paperMode === "dark" ? "var(--pk-bg-active)" : "transparent",
            color: settings.paperMode === "dark" ? "var(--pk-accent-primary)" : "inherit",
          }}
        >
          <Moon size={14} />
        </button>
        <button
          className={`pk-btn-icon ${settings.paperMode === "plain" ? "active" : ""}`}
          onClick={() => onUpdateSettings({ paperMode: "plain" })}
          title="Standard Clean White"
          style={{
            background: settings.paperMode === "plain" ? "var(--pk-bg-active)" : "transparent",
            color: settings.paperMode === "plain" ? "var(--pk-accent-primary)" : "inherit",
          }}
        >
          <Sun size={14} />
        </button>
      </div>

      <div style={{ width: "1px", height: "16px", background: "var(--pk-border-default)" }} />

      {/* Font Size & Typeface */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <button
          className="pk-btn-icon"
          onClick={() => {
            const nextFont =
              settings.fontFamily === "serif"
                ? "sans"
                : settings.fontFamily === "sans"
                ? "mono"
                : "serif";
            onUpdateSettings({ fontFamily: nextFont });
          }}
          title={`Typeface: ${settings.fontFamily.toUpperCase()}`}
        >
          <Type size={14} />
        </button>
        <button
          className="pk-btn-icon"
          onClick={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
          title="Decrease Font Size"
          style={{ fontSize: "11px", fontWeight: 700 }}
        >
          A-
        </button>
        <button
          className="pk-btn-icon"
          onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
          title="Increase Font Size"
          style={{ fontSize: "13px", fontWeight: 700 }}
        >
          A+
        </button>
      </div>

      <div style={{ width: "1px", height: "16px", background: "var(--pk-border-default)" }} />

      {/* In-Book Full-Text Search */}
      <button
        className={`pk-btn-icon ${isSearchOpen ? "active" : ""}`}
        onClick={onToggleSearch}
        title="Search within Book (Ctrl+F)"
        style={{
          background: isSearchOpen ? "var(--pk-bg-active)" : "transparent",
          color: isSearchOpen ? "var(--pk-accent-primary)" : "inherit",
        }}
      >
        <Search size={14} />
      </button>
    </div>
  );
};

