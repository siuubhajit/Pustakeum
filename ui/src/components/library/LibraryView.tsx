import React, { useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { BookTable } from "./BookTable";
import { Inspector } from "./Inspector";
import { BookView } from "../../state/useLibraryStore";

interface LibraryViewProps {
  books: BookView[];
  selectedBookId: number | null;
  onSelectBook: (id: number) => void;
  onOpenBook: (book: BookView) => void;
  onEditMetadata: () => void;
  onDeleteBook: (id: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedShelf: {
    type: "all" | "format" | "author" | "series" | "tag";
    value?: string;
  };
  onSelectShelf: (shelf: {
    type: "all" | "format" | "author" | "series" | "tag";
    value?: string;
  }) => void;
  onRevealInExplorer: (filePath: string) => void;
  onConvertBook: (book: BookView) => void;
  onOpenEpubEditor?: (book: BookView) => void;
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  selectedBookId,
  onSelectBook,
  onOpenBook,
  onEditMetadata,
  onDeleteBook,
  searchQuery,
  onSearchChange,
  selectedShelf,
  onSelectShelf,
  onRevealInExplorer,
  onConvertBook,
  onOpenEpubEditor,
  viewMode,
  onViewModeChange,
}) => {
  // Filter books according to selected virtual shelf
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (selectedShelf.type === "format" && selectedShelf.value) {
        return b.file_format === selectedShelf.value;
      }
      if (selectedShelf.type === "author" && selectedShelf.value) {
        return b.authors.includes(selectedShelf.value);
      }
      if (selectedShelf.type === "series" && selectedShelf.value) {
        return b.series === selectedShelf.value;
      }
      if (selectedShelf.type === "tag" && selectedShelf.value) {
        return b.tags.includes(selectedShelf.value);
      }
      return true;
    });
  }, [books, selectedShelf]);

  const activeBook = useMemo(() => {
    return books.find((b) => b.id === selectedBookId) || null;
  }, [books, selectedBookId]);

  return (
    <div className="pk-library-shell">
      <Sidebar
        books={books}
        selectedShelf={selectedShelf}
        onSelectShelf={onSelectShelf}
      />
      <BookTable
        books={filteredBooks}
        selectedBookId={selectedBookId}
        onSelectBook={onSelectBook}
        onOpenBook={onOpenBook}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onEditMetadata={onEditMetadata}
        onDeleteBook={onDeleteBook}
        onRevealInExplorer={onRevealInExplorer}
        onConvertBook={onConvertBook}
      />
      <Inspector
        book={activeBook}
        onOpenBook={onOpenBook}
        onEditMetadata={onEditMetadata}
        onDeleteBook={onDeleteBook}
        onRevealInExplorer={onRevealInExplorer}
        onConvertBook={onConvertBook}
        onOpenEpubEditor={onOpenEpubEditor}
      />
    </div>
  );
};

