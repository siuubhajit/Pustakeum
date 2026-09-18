import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  Sun,
  Moon,
  Plus,
  Minus,
  Square,
  Copy,
  X,
  FolderPlus,
  FilePlus,
  Download,
  ChevronDown,
  HardDrive,
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
  onOpenDeviceManager?: () => void;
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
  onOpenDeviceManager,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkState() {
      try {
        const max: boolean = await invoke("is_window_maximized");
        if (isMounted) setIsMaximized(max);
      } catch (_) {
        try {
          const max = await getCurrentWindow().isMaximized();
          if (isMounted) setIsMaximized(max);
        } catch (_) {}
      }
    }

    checkState();

    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onResized(async () => {
        try {
          const m = await getCurrentWindow().isMaximized();
          if (isMounted) setIsMaximized(m);
        } catch (_) {}
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (_) {}
  };

  const handleMaximize = async () => {
    try {
      const nowMax: boolean = await invoke("toggle_window_maximize");
      setIsMaximized(nowMax);
    } catch (_) {
      try {
        await getCurrentWindow().toggleMaximize();
        const m = await getCurrentWindow().isMaximized();
        setIsMaximized(m);
      } catch (err) {
        console.warn("Maximize error:", err);
      }
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (_) {}
  };

  return (
    <header className="pk-titlebar" data-tauri-drag-region onDoubleClick={handleMaximize}>
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

              {onOpenDeviceManager && (
                <>
                  <div style={{ height: "1px", background: "var(--pk-border-subtle)", margin: "4px 0" }} />
                  <button
                    className="pk-shelf-item"
                    style={{ border: "none", width: "100%", textAlign: "left", background: "transparent" }}
                    onClick={() => {
                      setShowAddMenu(false);
                      onOpenDeviceManager();
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <HardDrive size={14} color="#E5A93C" />
                      <span>USB E-Reader Sync...</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {onOpenDeviceManager && (
          <button
            className="pk-btn-icon"
            onClick={onOpenDeviceManager}
            title="USB / MTP E-Reader Hardware Manager"
          >
            <HardDrive size={15} />
          </button>
        )}

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
          <button
            className="pk-btn-icon"
            onClick={handleMaximize}
            title={isMaximized ? "Restore Window" : "Maximize Window"}
          >
            {isMaximized ? <Copy size={11} style={{ transform: "rotate(90deg)" }} /> : <Square size={12} />}
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
