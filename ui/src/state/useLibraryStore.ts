import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSavedTheme, applyTheme, ThemeMode } from "../theme/tokens";

export type { ThemeMode } from "../theme/tokens";

export interface BookView {
  id: number;
  uuid: string;
  title: string;
  authors: string[];
  series?: string;
  series_index?: number;
  file_format: string;
  file_path: string;
  file_size_bytes: number;
  page_count: number;
  publisher?: string;
  publication_year?: number;
  description?: string;
  isbn?: string;
  tags: string[];
  progress_percentage: number;
  current_page: number;
  last_read_at?: string;
  cover_image_path?: string;
}

export interface AnnotationView {
  id: number;
  uuid: string;
  book_id: number;
  annotation_type: string;
  page_index?: number;
  selected_text?: string;
  note_comment?: string;
  color_hex: string;
  created_at: string;
}

export interface TabItem {
  id: string; // 'library' or `book-${id}`
  title: string;
  type: "library" | "reader";
  bookId?: number;
}

export interface ReaderSettings {
  fontSize: number;
  paperMode: "parchment" | "dark" | "plain";
  fontFamily: "serif" | "sans" | "mono";
  zoomLevel: number;
}

export function useLibraryState() {
  const [books, setBooks] = useState<BookView[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: "library", title: "Library (ग्रन्थालय)", type: "library" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("library");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedShelf, setSelectedShelf] = useState<{
    type: "all" | "format" | "author" | "series" | "tag";
    value?: string;
  }>({ type: "all" });
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme());
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    fontSize: 19,
    paperMode: "parchment",
    fontFamily: "serif",
    zoomLevel: 100,
  });
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [bookToConvert, setBookToConvert] = useState<BookView | null>(null);
  const [loading, setLoading] = useState(false);

  // Load books on init
  const refreshBooks = async () => {
    try {
      setLoading(true);
      const res: BookView[] = await invoke("get_library_books");
      setBooks(res);
      if (res.length > 0 && selectedBookId === null) {
        setSelectedBookId(res[0].id);
      }
    } catch (err) {
      console.warn("Failed to load library books via Tauri invoke, using fallback data if needed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBooks();
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "bhurjapatra" ? "nila-krshna" : "bhurjapatra";
    setTheme(next);
    applyTheme(next);
  };

  const openBookInTab = (book: BookView) => {
    const tabId = `book-${book.id}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (!existing) {
      setTabs([...tabs, { id: tabId, title: book.title, type: "reader", bookId: book.id }]);
    }
    setActiveTabId(tabId);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabId === "library") return; // cannot close library root
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  return {
    books,
    setBooks,
    selectedBookId,
    setSelectedBookId,
    tabs,
    activeTabId,
    setActiveTabId,
    openBookInTab,
    closeTab,
    searchQuery,
    setSearchQuery,
    selectedShelf,
    setSelectedShelf,
    theme,
    toggleTheme,
    readerSettings,
    setReaderSettings,
    isEditingMetadata,
    setIsEditingMetadata,
    bookToConvert,
    setBookToConvert,
    refreshBooks,
    loading,
  };
}
