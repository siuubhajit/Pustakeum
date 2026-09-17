import React, { useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Titlebar } from "./components/common/Titlebar";
import { LibraryView } from "./components/library/LibraryView";
import { ReaderView } from "./components/reader/ReaderView";
import { MetadataModal } from "./components/editor/MetadataModal";
import { useLibraryState, BookView } from "./state/useLibraryStore";

export const App: React.FC = () => {
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
    readerSettings,
    setReaderSettings,
    isEditingMetadata,
    setIsEditingMetadata,
    refreshBooks,
  } = useLibraryState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // On webview/Tauri desktop, file path or name is available
      const filePath = (file as any).path || file.name;
      try {
        const imported: BookView = await invoke("import_book_file", { filePath });
        setBooks((prev) => [imported, ...prev.filter((b) => b.id !== imported.id)]);
        setSelectedBookId(imported.id);
      } catch (err) {
        console.warn("Import error:", err);
      }
    }
    // reset input
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
      // update local state
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
      {/* Hidden file picker */}
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
        onImportBook={handleImportClick}
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
          />
        ) : activeTab?.bookId ? (
          <ReaderView
            key={activeTab.bookId}
            bookId={activeTab.bookId}
            settings={readerSettings}
            onUpdateSettings={(s) => setReaderSettings((prev) => ({ ...prev, ...s }))}
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
    </div>
  );
};

