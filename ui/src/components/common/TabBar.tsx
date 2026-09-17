import React from "react";
import { BookOpen, Library, X } from "lucide-react";
import { TabItem } from "../../state/useLibraryStore";

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}) => {
  return (
    <div className="pk-tab-bar" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`pk-tab ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(tab.id)}
            title={tab.title}
          >
            {tab.type === "library" ? (
              <Library size={14} style={{ flexShrink: 0 }} />
            ) : (
              <BookOpen size={14} style={{ flexShrink: 0 }} />
            )}
            <span className="pk-tab-title">{tab.title}</span>
            {tab.id !== "library" && (
              <button
                className="pk-btn-icon"
                style={{ padding: "2px", marginLeft: "4px" }}
                onClick={(e) => onCloseTab(tab.id, e)}
                title="Close Tab (Ctrl+W)"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

