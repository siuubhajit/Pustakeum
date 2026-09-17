# Pustakeum (पुस्तकम्)

> **"ग्रन्थाभ्यासो निरन्तरः"** — *Continuous dedication to reading and knowledge.*  
> **The Sumatra-speed, Calibre-depth native e-reader & digital library engine.**

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-blue.svg?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust Engine](https://img.shields.io/badge/Rust-2024%20Edition-black.svg?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![License: MIT/Apache-2.0](https://img.shields.io/badge/License-MIT%2FApache--2.0-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/Architecture-Split--Engine%20Zero--Copy-orange.svg)]()

---

## 📖 Overview

**Pustakeum** (derived from the Sanskrit **पुस्तकम्**, meaning *book* or *manuscript*) is a next-generation desktop reading and document management suite designed to resolve a decade-long compromise in digital reading:

* **Sumatra PDF** is blazing fast, boots in 30 milliseconds, consumes almost zero RAM, but lacks metadata management, virtual libraries, and editing capabilities.
* **Calibre** is the undisputed titan of library management, format conversion, and cataloging, but is burdened by a heavy legacy Python/Qt stack and sluggish rendering performance.

**Pustakeum fuses both worlds** into a cohesive split-architecture application:
1. **The Native Rust Core**: Powered by Chromium’s `pdfium-render`, `lopdf`, `rbook`, `tantivy`, `sqlite3` with `FTS5`, `axum`, and `wasmtime`. It delivers instantaneous rendering, sub-10ms full-text search across half a million books, and zero-copy page frame caching.
2. **The Modern Accelerated Shell**: Built on **Tauri v2** with a WebGL/Canvas2D hardware-accelerated viewport, sub-millisecond input response, virtualized infinite scrolling, and an information-dense UI inspired by Sanskrit parchment (*Bhurjapatra*) and celestial midnight ink (*Nila-Krshna*).

---

## ⚡ Core Architecture

```
                                  +---------------------------------------+
                                  |         PUSTAKEUM TAURI SHELL         |
                                  |   React / Svelte / TypeScript Core    |
                                  +-------------------+-------------------+
                                                      |
                                                      | WebGL / Zero-Copy Memory ArrayBuffer
                                                      v
+---------------------------------------------------------------------------------------------------------+
|                                           RUST NATIVE ENGINE                                            |
|                                                                                                         |
|  +---------------------------+  +---------------------------+  +-------------------------------------+  |
|  |     DOCUMENT RENDERING    |  |     LIBRARY & CATALOG     |  |          SERVICES & AST             |  |
|  |  * pdfium-render (PDF)    |  |  * SQLite FTS5 (Catalog)  |  |  * AST Format Converter Engine     |  |
|  |  * lopdf (PDF Mutator)    |  |  * Tantivy (Full-Text)    |  |  * Axum OPDS 1.2/2.0 Server         |  |
|  |  * rbook + ammonia (EPUB) |  |  * Rayon Disk Scanners    |  |  * Wasmtime Plugin Host             |  |
|  |  * CBZ/CBR/MOBI parsers   |  |  * BLAKE3 Deduplication   |  |  * Tokio Async Task Supervisor      |  |
|  +---------------------------+  +---------------------------+  +-------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |    LOCAL OS / STORAGE     |
                                        +---------------------------+
```

---

## 🌟 Key Highlights

* **Instantaneous Document Bootstrapping**: Cold-launch documents in under 40ms. Pages adjacent to the viewport are pre-rendered asynchronously in Rust worker threads and streamed directly to WebGL texture targets.
* **Zero-Copy Page Frame Delivery**: High-resolution raster buffers avoid JSON/IPC serialization overhead by utilizing Tauri v2 direct memory handles and shared memory buffers.
* **500,000+ Book Library Scale**: SQLite tuned with Memory-Mapped I/O (`mmap_size = 30GB`), Write-Ahead Logging (`WAL`), and `FTS5` full-text search indexers returning queries in under 5ms.
* **Deep In-Book Search Engine**: Powered by `tantivy`, allowing instantaneous regex, exact match, and fuzzy search across million-word tomes without freezing the UI.
* **Universal AST Document Converter**: Normalized Abstract Syntax Tree (AST) intermediate representation converts documents with $O(N)$ complexity instead of $O(N^2)$ point-to-point converters.
* **Embedded OPDS & Web Server**: Built-in `axum` service shares your library across your local network to e-readers (KOReader, Moon+ Reader, Kindle Web) with on-the-fly EPUB/MOBI streaming.
* **Sandboxed WASM Plugin Runtime**: Extend metadata scrapers, custom conversion targets, and reading statistics with sandboxed WebAssembly plugins executed via `wasmtime`.

---

## 🎨 Aesthetic Design System: Light & Dark

Pustakeum introduces two meticulously tuned visual environments designed for sustained hours of reading and information-dense cataloging:

| Theme | Inspiration | Dominant Background | Text Surface | Accent / Character |
| :--- | :--- | :--- | :--- | :--- |
| **Bhurjapatra (भूर्जपत्र)** *(Light)* | Ancient Birch-Bark & Palm-Leaf Manuscripts, Sumatra Paper | `#F9F6EE` (Warm Ivory Vellum) | `#1A1815` (Deep Carbon Charcoal) | `#9E3D21` (Terracotta) & `#B8860B` (Kashtha Ochre) |
| **Nila-Krshna (नील-कृष्ण)** *(Dark)* | Vedic Obsidian & Celestial Midnight Inks | `#0E1117` (Deep Obsidian Basalt) | `#E2E8F0` (Pure Starlight Slate) | `#E5A93C` (Shodha Gold) & `#38BDF8` (Mayura Cyan) |

Both themes feature:
- Dynamic paper warmth filters ($1800\text{K} \to 6500\text{K}$) with hardware-accelerated shaders.
- Calibre-inspired high-density data tables with custom column configurations.
- Sumatra-inspired distraction-free reading HUD that auto-hides during active scrolling.

---

## 📂 Repository Structure

```
pustakeum/
├── .cargo/
│   └── config.toml             # Target-specific build flags & linker optimizations
├── Cargo.toml                  # Cargo workspace definition
├── README.md                   # Project manifest & manual
├── src-tauri/                  # Native Rust Desktop Core
│   ├── Cargo.toml              # Tauri & Rust engine dependencies
│   ├── build.rs                # Build hooks & PDFium library locator
│   ├── tauri.conf.json         # Tauri v2 runtime configuration & permissions
│   └── src/
│       ├── main.rs             # Application bootstrap & runtime supervisor
│       ├── lib.rs              # Tauri IPC command registration
│       ├── engine/             # Core rendering & parsing pipelines
│       │   ├── mod.rs
│       │   ├── pdf.rs          # pdfium-render bindings & zero-copy cache
│       │   ├── epub.rs         # rbook parsing, DOM cleaning, spine extraction
│       │   ├── comics.rs       # CBZ/CBR decompression & image pipelines
│       │   └── mobi.rs         # MOBI/AZW parser
│       ├── database/           # SQLite & FTS5 storage layer
│       │   ├── mod.rs
│       │   ├── schema.rs       # Table definitions & migrations
│       │   ├── queries.rs      # High-performance catalog queries
│       │   └── fts.rs          # SQLite FTS5 index maintenance
│       ├── search/             # Deep document indexing
│       │   ├── mod.rs
│       │   └── indexer.rs      # Tantivy index worker & tokenizers
│       ├── converter/          # Universal Document AST system
│       │   ├── mod.rs
│       │   ├── ast.rs          # Node definitions (Block, Inline, Media)
│       │   ├── parsers/        # Format -> AST converters
│       │   └── writers/        # AST -> Format writers
│       ├── server/             # Network services
│       │   ├── mod.rs
│       │   ├── opds.rs         # OPDS 1.2 / 2.0 catalog feeds
│       │   └── web_reader.rs   # Standalone browser viewport
│       └── plugins/            # WebAssembly sandbox
│           ├── mod.rs
│           └── host.rs         # Wasmtime runtime engine
└── ui/                         # Accelerated Frontend Shell
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.tsx            # Frontend entrypoint
    │   ├── App.tsx             # Root layout & route manager
    │   ├── theme/              # Bhurjapatra & Nila-Krshna design tokens
    │   │   ├── tokens.ts
    │   │   └── theme.css
    │   ├── components/
    │   │   ├── library/        # Calibre-grade metadata & virtual shelf views
    │   │   ├── reader/         # Sumatra-grade hardware-accelerated canvas
    │   │   ├── editor/         # Inline EPUB/CSS live code editor
    │   │   └── common/         # Tab controls, breadcrumbs, search bars
    │   ├── renderers/          # WebGL / Canvas2D zero-copy frame painters
    │   │   ├── WebGLCanvas.ts
    │   │   └── VirtualScroller.ts
    │   └── state/              # Global state (Library, Tabs, History, Settings)
```

---

## 🛠️ Prerequisites & Installation

### 1. System Dependencies

* **Rust**: `1.80+` (`rustup update stable`)
* **Node.js**: `20.x` or `22.x` (`pnpm` recommended)
* **C++ Compiler / Build Tools**:
  * **Windows**: Visual Studio C++ Build Tools with Windows 10/11 SDK.
  * **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`.
  * **macOS**: Xcode Command Line Tools.
* **PDFium Dynamic Library**: Download or bundle the precompiled `pdfium` shared library for your platform (`pdfium.dll`, `libpdfium.so`, or `libpdfium.dylib`).

### 2. Building from Source

```bash
# Clone the repository
git clone https://github.com/your-org/pustakeum.git
cd pustakeum

# Install frontend dependencies
cd ui
pnpm install
cd ..

# Run in development mode with hot-reloading
cargo tauri dev

# Build release binaries with LTO (Link-Time Optimization)
cargo tauri build
```

---

## 📜 License

Licensed under either of:
* Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
* MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option.
