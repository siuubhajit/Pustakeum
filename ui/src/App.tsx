import React, { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Titlebar } from "./components/common/Titlebar";
import { LibraryView } from "./components/library/LibraryView";
import { ReaderView } from "./components/reader/ReaderView";
import { MetadataModal } from "./components/editor/MetadataModal";
import { ConvertModal } from "./components/editor/ConvertModal";
import { EpubCodeEditor } from "./components/editor/EpubCodeEditor";
import { DeviceManagerModal } from "./components/hardware/DeviceManagerModal";
import { AnkiModal } from "./components/reader/AnkiModal";
import { useLibraryState, BookView } from "./state/useLibraryStore";

export const App: React.FC = () => {
  const [epubToEdit, setEpubToEdit] = useState<BookView | null>(null);
  const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
  const [ankiCardData, setAnkiCardData] = useState<{ text: string; title: string; page?: number } | null>(null);

  const {
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
    setReaderSettings,
    isEditingMetadata,
    setIsEditingMetadata,
    bookToConvert,
    setBookToConvert,
    refreshBooks,
  } = useLibraryState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Native Multi-File Picker Dialog
  const handlePickFiles = async () => {
    try {
      const paths: string[] = await invoke("pick_files_dialog");
      if (paths && paths.length > 0) {
        for (const filePath of paths) {
          try {
            const imported: BookView = await invoke("import_book_file", { filePath });
            setBooks((prev) => [imported, ...prev.filter((b) => b.id !== imported.id)]);
            setSelectedBookId(imported.id);
          } catch (err) {
            console.warn("Error importing file:", filePath, err);
          }
        }
      }
    } catch (err) {
      console.warn("File picker error:", err);
    }
  };

  // Native Recursive Directory Picker Dialog
  const handlePickFolder = async () => {
    try {
      const dirPath: string | null = await invoke("pick_directory_dialog");
      if (dirPath) {
        const imported: BookView[] = await invoke("import_directory_recursive", { dirPath });
        console.log(`Imported ${imported.length} books from directory:`, dirPath);
        await refreshBooks();
      }
    } catch (err) {
      console.warn("Directory picker error:", err);
    }
  };

  // Catalog Export (JSON / CSV)
  const handleExportCatalog = async (format: "json" | "csv") => {
    try {
      const savedPath: string = await invoke("export_library_catalog", { format });
      console.log(`Catalog exported successfully to: ${savedPath}`);
    } catch (err) {
      if (err !== "Export cancelled") {
        console.warn("Catalog export error:", err);
      }
    }
  };

  // Native Reveal in Explorer
  const handleRevealInExplorer = async (filePath: string) => {
    try {
      await invoke("reveal_in_explorer", { filePath });
    } catch (err) {
      console.warn("Reveal in explorer error:", err);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as any).path || file.name;
      try {
        const imported: BookView = await invoke("import_book_file", { filePath });
        setBooks((prev) => [imported, ...prev.filter((b) => b.id !== imported.id)]);
        setSelectedBookId(imported.id);
      } catch (err) {
        console.warn("Import error:", err);
      }
    }
    e.target.value = "";
  };

  const handleSearchChange = async (q: string) => {
    setSearchQuery(q);
    try {
      const results: BookView[] = await invoke("search_books", { query: q });
      setBooks(results);
    } catch (err) {
      console.warn("Search error:", err);
    }
  };

  const handleUpdateProgress = async (bookId: number, page: number, pct: number) => {
    try {
      await invoke("update_reading_progress", {
        bookId,
        currentPage: page,
        currentCfi: null,
        progressPercentage: pct,
      });
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId
            ? { ...b, current_page: page, progress_percentage: pct }
            : b
        )
      );
    } catch (err) {
      console.warn("Progress update error:", err);
    }
  };

  const handleSaveMetadata = async (updated: any) => {
    try {
      await invoke("update_book_metadata", { update: updated });
      setIsEditingMetadata(false);
      refreshBooks();
    } catch (err) {
      console.warn("Metadata save error:", err);
    }
  };

  const handleDeleteBook = async (id: number) => {
    if (!confirm("Are you sure you want to remove this book from your library?")) return;
    try {
      await invoke("delete_book", { bookId: id });
      closeTab(`book-${id}`);
      refreshBooks();
    } catch (err) {
      console.warn("Delete error:", err);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeBookToEdit = books.find((b) => b.id === selectedBookId) || null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hidden fallback file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.epub,.cbz,.cbr,.txt"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* Top Application Bar & Sumatra Tab Row */}
      <Titlebar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPickFiles={handlePickFiles}
        onPickFolder={handlePickFolder}
        onExportCatalog={handleExportCatalog}
        onOpenDeviceManager={() => setIsDeviceManagerOpen(true)}
      />

      {/* Main Workspace Stage */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {activeTab?.type === "library" ? (
          <LibraryView
            books={books}
            selectedBookId={selectedBookId}
            onSelectBook={setSelectedBookId}
            onOpenBook={openBookInTab}
            onEditMetadata={() => setIsEditingMetadata(true)}
            onDeleteBook={handleDeleteBook}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedShelf={selectedShelf}
            onSelectShelf={setSelectedShelf}
            onRevealInExplorer={handleRevealInExplorer}
            onConvertBook={(book) => setBookToConvert(book)}
            onOpenEpubEditor={(book) => setEpubToEdit(book)}
            viewMode={libraryViewMode}
            onViewModeChange={changeLibraryViewMode}
          />
        ) : activeTab?.bookId ? (
          <ReaderView
            key={activeTab.bookId}
            bookId={activeTab.bookId}
            settings={readerSettings}
            onUpdateSettings={(s) => setReaderSettings(s)}
            onUpdateProgress={handleUpdateProgress}
          />
        ) : null}
      </div>

      {/* Calibre Metadata Editor Modal */}
      {isEditingMetadata && activeBookToEdit && (
        <MetadataModal
          book={activeBookToEdit}
          onClose={() => setIsEditingMetadata(false)}
          onSave={handleSaveMetadata}
        />
      )}

      {/* AST Document Conversion Modal */}
      {bookToConvert && (
        <ConvertModal
          book={bookToConvert}
          onClose={() => setBookToConvert(null)}
        />
      )}

      {/* Live Split-Pane EPUB Code Editor */}
      {epubToEdit && (
        <EpubCodeEditor
          filePath={epubToEdit.file_path}
          bookTitle={epubToEdit.title}
          onClose={() => setEpubToEdit(null)}
        />
      )}

      {/* USB / MTP E-Reader Hardware Manager Modal */}
      {isDeviceManagerOpen && (
        <DeviceManagerModal
          books={books}
          onClose={() => setIsDeviceManagerOpen(false)}
        />
      )}

      {/* Anki Flashcard Sync Modal */}
      {ankiCardData && (
        <AnkiModal
          initialText={ankiCardData.text}
          sourceTitle={ankiCardData.title}
          pageNumber={ankiCardData.page}
          onClose={() => setAnkiCardData(null)}
        />
      )}
    </div>
  );
};

