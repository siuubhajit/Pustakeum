import React, { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Sun,
  Moon,
  Plus,
  Minus,
  Square,
  X,
  FolderPlus,
  FilePlus,
  Download,
  ChevronDown,
} from "lucide-react";
import { TabBar } from "./TabBar";
import { TabItem, ThemeMode } from "../../state/useLibraryStore";

interface TitlebarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onExportCatalog: (fmt: "json" | "csv") => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  theme,
  onToggleTheme,
  onPickFiles,
  onPickFolder,
  onExportCatalog,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (_) {}
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (_) {}
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (_) {}
  };

  return (
    <header className="pk-titlebar" data-tauri-drag-region>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0 6px",
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "0.05em",
            color: "var(--pk-accent-primary)",
            cursor: "default",
          }}
        >
          <span style={{ fontSize: "16px", fontFamily: "var(--pk-font-serif)" }}>पुस्तकम्</span>
          <span style={{ fontSize: "12px", opacity: 0.8, fontWeight: 500 }}>PUSTAKEUM</span>
        </div>

        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
        {/* Add / Import Menu Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            className="pk-btn"
            style={{ padding: "3px 8px", fontSize: "12px" }}
            onClick={() => setShowAddMenu(!showAddMenu)}
            title="Import or Export Documents"
          >
            <Plus size={13} />
            <span>Manage Library</span>
            <ChevronDown size={11} />
          </button>

          {showAddMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                width: "200px",
                backgroundColor: "var(--pk-bg-surface)",
                border: "1px solid var(--pk-border-default)",
                borderRadius: "var(--pk-radius-md)",
                boxShadow: "var(--pk-shadow-lg)",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                padding: "4px 0",
              }}
              onMouseLeave={() => setShowAddMenu(false)}
            >
              <button
                className="pk-shelf-item"
                style={{ border: "none", width: "100%", textAlign: "left", background: "transparent" }}
                onClick={() => {
                  setShowAddMenu(false);
                  onPickFiles();
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FilePlus size={14} />
                  <span>Import Files...</span>
                </div>
              </button>

              <button
                className="pk-shelf-item"
                style={{ border: "none", width: "100%", textAlign: "left", background: "transparent" }}
                onClick={() => {
                  setShowAddMenu(false);
                  onPickFolder();
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FolderPlus size={14} />
                  <span>Import Folder...</span>
                </div>
              </button>

              <div style={{ height: "1px", background: "var(--pk-border-subtle)", margin: "4px 0" }} />

              <button
                className="pk-shelf-item"
                style={{ border: "none", width: "100%", textAlign: "left", background: "transparent" }}
                onClick={() => {
                  setShowAddMenu(false);
                  onExportCatalog("json");
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Download size={14} />
                  <span>Export Catalog (JSON)</span>
                </div>
              </button>

              <button
                className="pk-shelf-item"
                style={{ border: "none", width: "100%", textAlign: "left", background: "transparent" }}
                onClick={() => {
                  setShowAddMenu(false);
                  onExportCatalog("csv");
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Download size={14} />
                  <span>Export Catalog (CSV)</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          className="pk-btn-icon"
          onClick={onToggleTheme}
          title={`Switch Theme (Current: ${
            theme === "bhurjapatra" ? "Bhurjapatra भूर्जपत्र" : "Nila-Krshna नील-कृष्ण"
          })`}
        >
          {theme === "bhurjapatra" ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <div style={{ width: "1px", height: "18px", background: "var(--pk-border-subtle)", margin: "0 4px" }} />

        <div style={{ display: "flex", alignItems: "center" }}>
          <button className="pk-btn-icon" onClick={handleMinimize} title="Minimize">
            <Minus size={13} />
          </button>
          <button className="pk-btn-icon" onClick={handleMaximize} title="Maximize">
            <Square size={12} />
          </button>
          <button
            className="pk-btn-icon"
            onClick={handleClose}
            title="Close"
            style={{ color: "var(--pk-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#E11D48")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--pk-text-muted)")}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
