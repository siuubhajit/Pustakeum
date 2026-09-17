import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { BookView } from "../../state/useLibraryStore";

interface MetadataModalProps {
  book: BookView;
  onClose: () => void;
  onSave: (updated: {
    id: number;
    title: string;
    authors: string[];
    series?: string;
    series_index?: number;
    tags: string[];
    publisher?: string;
    publication_year?: number;
    description?: string;
    isbn?: string;
  }) => void;
}

export const MetadataModal: React.FC<MetadataModalProps> = ({
  book,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors.join(", "));
  const [series, setSeries] = useState(book.series || "");
  const [seriesIndex, setSeriesIndex] = useState(book.series_index?.toString() || "1");
  const [tags, setTags] = useState(book.tags.join(", "));
  const [publisher, setPublisher] = useState(book.publisher || "");
  const [publicationYear, setPublicationYear] = useState(book.publication_year?.toString() || "");
  const [isbn, setIsbn] = useState(book.isbn || "");
  const [description, setDescription] = useState(book.description || "");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: book.id,
      title: title.trim(),
      authors: authors.split(",").map((s) => s.trim()).filter(Boolean),
      series: series.trim() || undefined,
      series_index: seriesIndex ? parseFloat(seriesIndex) : undefined,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      publisher: publisher.trim() || undefined,
      publication_year: publicationYear ? parseInt(publicationYear, 10) : undefined,
      description: description.trim() || undefined,
      isbn: isbn.trim() || undefined,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "560px",
          maxHeight: "90vh",
          backgroundColor: "var(--pk-bg-surface)",
          border: "1px solid var(--pk-border-default)",
          borderRadius: "var(--pk-radius-lg)",
          boxShadow: "var(--pk-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pk-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--pk-text-primary)" }}>
            Edit Document Metadata (Calibre Engine)
          </h3>
          <button className="pk-btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleFormSubmit} style={{ padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "var(--pk-radius-sm)",
                border: "1px solid var(--pk-border-default)",
                background: "var(--pk-bg-base)",
                color: "var(--pk-text-primary)",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              Authors (comma-separated)
            </label>
            <input
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "var(--pk-radius-sm)",
                border: "1px solid var(--pk-border-default)",
                background: "var(--pk-bg-base)",
                color: "var(--pk-text-primary)",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Series
              </label>
              <input
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "13px",
                  borderRadius: "var(--pk-radius-sm)",
                  border: "1px solid var(--pk-border-default)",
                  background: "var(--pk-bg-base)",
                  color: "var(--pk-text-primary)",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Number
              </label>
              <input
                type="number"
                step="0.1"
                value={seriesIndex}
                onChange={(e) => setSeriesIndex(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "13px",
                  borderRadius: "var(--pk-radius-sm)",
                  border: "1px solid var(--pk-border-default)",
                  background: "var(--pk-bg-base)",
                  color: "var(--pk-text-primary)",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "var(--pk-radius-sm)",
                border: "1px solid var(--pk-border-default)",
                background: "var(--pk-bg-base)",
                color: "var(--pk-text-primary)",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Publisher
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "13px",
                  borderRadius: "var(--pk-radius-sm)",
                  border: "1px solid var(--pk-border-default)",
                  background: "var(--pk-bg-base)",
                  color: "var(--pk-text-primary)",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Year
              </label>
              <input
                type="number"
                value={publicationYear}
                onChange={(e) => setPublicationYear(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "13px",
                  borderRadius: "var(--pk-radius-sm)",
                  border: "1px solid var(--pk-border-default)",
                  background: "var(--pk-bg-base)",
                  color: "var(--pk-text-primary)",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              ISBN
            </label>
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "var(--pk-radius-sm)",
                border: "1px solid var(--pk-border-default)",
                background: "var(--pk-bg-base)",
                color: "var(--pk-text-primary)",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              Description / Synopsis
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "13px",
                borderRadius: "var(--pk-radius-sm)",
                border: "1px solid var(--pk-border-default)",
                background: "var(--pk-bg-base)",
                color: "var(--pk-text-primary)",
                fontFamily: "var(--pk-font-sans)",
                resize: "vertical",
              }}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" className="pk-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pk-btn pk-btn-primary">
              <Save size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

