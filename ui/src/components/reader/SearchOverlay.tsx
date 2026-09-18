import React, { useState, useEffect } from "react";
import { Search, X, ChevronRight, Cpu } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface SearchMatch {
  section_index: number;
  section_title: string;
  snippet: string;
  match_position: number;
  rrf_score?: number;
}

interface HybridSearchResult {
  book_id: number;
  title: string;
  page_number?: number;
  snippet: string;
  fts_rank: number;
  vec_rank: number;
  rrf_score: number;
  lexical_bm25_score: number;
  vector_cosine_score: number;
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
  const [isHybrid, setIsHybrid] = useState(false);
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
        if (isHybrid) {
          // Execute 384d Dense Vector + FTS5 Hybrid Search with RRF
          const hybridHits: HybridSearchResult[] = await invoke("cmd_query_hybrid_search", {
            query: query.trim(),
            limit: 20,
          });
          const mapped: SearchMatch[] = hybridHits.map((h, idx) => ({
            section_index: h.page_number || idx + 1,
            section_title: `${h.title} (RRF: ${(h.rrf_score * 100).toFixed(1)}%)`,
            snippet: h.snippet,
            match_position: idx,
            rrf_score: h.rrf_score,
          }));
          setMatches(mapped);
        } else {
          // In-book exact lexical search
          const results: SearchMatch[] = await invoke("search_in_book", {
            bookId,
            query: query.trim(),
          });
          setMatches(results);
        }
      } catch (err) {
        console.warn("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, bookId, isHybrid]);

  return (
    <div className="pk-search-dialog" style={{ width: 380 }}>
      {/* Top Search Input & Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Search size={14} style={{ color: "var(--pk-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          placeholder={isHybrid ? "Semantic vector search (AI)..." : "Exact search in document..."}
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

      {/* Mode Switcher: Lexical vs Hybrid AI */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div style={{ fontSize: "11px", color: "var(--pk-text-muted)" }}>
          {isSearching
            ? "Executing search..."
            : query.trim()
            ? `${matches.length} matches found`
            : "Type a word or query to search"}
        </div>

        <button
          onClick={() => setIsHybrid(!isHybrid)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            background: isHybrid ? "rgba(229, 169, 60, 0.15)" : "var(--pk-bg-elevated)",
            color: isHybrid ? "var(--pk-accent-primary)" : "var(--pk-text-secondary)",
            border: `1px solid ${isHybrid ? "var(--pk-accent-primary)" : "var(--pk-border-default)"}`,
            borderRadius: 4,
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 500,
          }}
          title="Toggle Hybrid Dense Vector Search with Reciprocal Rank Fusion"
        >
          <Cpu size={12} />
          <span>{isHybrid ? "Hybrid 384d RRF" : "Exact FTS5"}</span>
        </button>
      </div>

      {/* Search Results List */}
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
            <div
              style={{
                fontWeight: 600,
                color: "var(--pk-accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "2px",
              }}
            >
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
