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

export type LibraryViewMode = "table" | "grid";

export interface AppSettingsDto {
  theme: string;
  library_view_mode: string;
  font_size: number;
  paper_mode: string;
  font_family: string;
  zoom_level: number;
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
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("grid");
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

  // Load Sumatra-style JSON settings on init
  useEffect(() => {
    refreshBooks();

    async function loadSettings() {
      try {
        const s: AppSettingsDto = await invoke("get_app_settings");
        if (s) {
          if (s.theme === "bhurjapatra" || s.theme === "nila-krshna") {
            setTheme(s.theme as ThemeMode);
            applyTheme(s.theme as ThemeMode);
          }
          if (s.library_view_mode === "table" || s.library_view_mode === "grid") {
            setLibraryViewMode(s.library_view_mode as LibraryViewMode);
          }
          setReaderSettings({
            fontSize: s.font_size || 19,
            paperMode: (s.paper_mode as any) || "parchment",
            fontFamily: (s.font_family as any) || "serif",
            zoomLevel: s.zoom_level || 100,
          });
        }
      } catch (err) {
        console.warn("Could not load app settings from json:", err);
      }
    }
    loadSettings();
  }, []);

  const saveCurrentSettings = (patch: Partial<AppSettingsDto>) => {
    const next: AppSettingsDto = {
      theme: patch.theme !== undefined ? patch.theme : theme,
      library_view_mode: patch.library_view_mode !== undefined ? patch.library_view_mode : libraryViewMode,
      font_size: patch.font_size !== undefined ? patch.font_size : readerSettings.fontSize,
      paper_mode: patch.paper_mode !== undefined ? patch.paper_mode : readerSettings.paperMode,
      font_family: patch.font_family !== undefined ? patch.font_family : readerSettings.fontFamily,
      zoom_level: patch.zoom_level !== undefined ? patch.zoom_level : readerSettings.zoomLevel,
    };
    invoke("save_app_settings", { settings: next }).catch((e) =>
      console.warn("Failed to save settings:", e)
    );
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === "bhurjapatra" ? "nila-krshna" : "bhurjapatra";
    setTheme(next);
    applyTheme(next);
    saveCurrentSettings({ theme: next });
  };

  const changeLibraryViewMode = (mode: LibraryViewMode) => {
    setLibraryViewMode(mode);
    saveCurrentSettings({ library_view_mode: mode });
  };

  const updateReaderSettings = (
    updater: Partial<ReaderSettings> | ((prev: ReaderSettings) => ReaderSettings)
  ) => {
    setReaderSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveCurrentSettings({
        font_size: next.fontSize,
        paper_mode: next.paperMode,
        font_family: next.fontFamily,
        zoom_level: next.zoomLevel,
      });
      return next;
    });
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
    libraryViewMode,
    changeLibraryViewMode,
    readerSettings,
    setReaderSettings: updateReaderSettings,
    isEditingMetadata,
    setIsEditingMetadata,
    bookToConvert,
    setBookToConvert,
    refreshBooks,
    loading,
  };
}
