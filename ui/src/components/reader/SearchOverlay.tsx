import React, { useState, useEffect } from "react";
import { Search, X, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface SearchMatch {
  section_index: number;
  section_title: string;
  snippet: string;
  match_position: number;
}

interface SearchOverlayProps {
  bookId: number;
  onClose: () => void;
  onSelectMatch: (match: SearchMatch) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  bookId,
  onClose,
  onSelectMatch,
}) => {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results: SearchMatch[] = await invoke("search_in_book", {
          bookId,
          query: query.trim(),
        });
        setMatches(results);
      } catch (err) {
        console.warn("In-book search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, bookId]);

  return (
    <div className="pk-search-dialog">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Search size={14} style={{ color: "var(--pk-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search in book..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: "13px",
            background: "var(--pk-bg-base)",
            border: "1px solid var(--pk-border-default)",
            borderRadius: "var(--pk-radius-sm)",
            color: "var(--pk-text-primary)",
            outline: "none",
          }}
        />
        <button className="pk-btn-icon" onClick={onClose} title="Close Search (Esc)">
          <X size={14} />
        </button>
      </div>

      <div style={{ fontSize: "11px", color: "var(--pk-text-muted)", marginBottom: "8px" }}>
        {isSearching
          ? "Searching..."
          : query.trim()
          ? `${matches.length} matches found`
          : "Type a word or phrase to find in text"}
      </div>

      <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        {matches.map((m, idx) => (
          <div
            key={idx}
            onClick={() => onSelectMatch(m)}
            style={{
              padding: "6px 8px",
              borderRadius: "var(--pk-radius-sm)",
              background: "var(--pk-bg-elevated)",
              cursor: "pointer",
              fontSize: "12px",
              transition: "background var(--pk-transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pk-bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--pk-bg-elevated)")}
          >
            <div style={{ fontWeight: 600, color: "var(--pk-accent-primary)", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
              <span>{m.section_title}</span>
              <ChevronRight size={12} />
            </div>
            <div style={{ color: "var(--pk-text-secondary)", lineHeight: 1.4 }}>
              {m.snippet}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

