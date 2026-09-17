pub mod ast;

use ast::{AstMetadata, AstNode, AstSection, DocumentAst};
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// Convert plain text to Document AST
pub fn parse_text_to_ast<P: AsRef<Path>>(path: P) -> Result<DocumentAst, String> {
    let content = std::fs::read_to_string(path.as_ref())
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let title = path
        .as_ref()
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Document")
        .to_string();

    let mut nodes = Vec::new();
    for paragraph in content.split("\n\n") {
        let trimmed = paragraph.trim();
        if !trimmed.is_empty() {
            if trimmed.starts_with('#') {
                let level = trimmed.chars().take_while(|&c| c == '#').count() as u8;
                let text = trimmed.trim_start_matches('#').trim().to_string();
                nodes.push(AstNode::Heading { level, text });
            } else {
                nodes.push(AstNode::Paragraph { text: trimmed.to_string() });
            }
        }
    }

    Ok(DocumentAst {
        metadata: AstMetadata {
            title: title.clone(),
            authors: vec!["Author".to_string()],
            language: "en".to_string(),
            identifier: None,
        },
        sections: vec![AstSection {
            title,
            nodes,
        }],
    })
}

/// Convert EPUB file to Document AST
pub fn parse_epub_to_ast<P: AsRef<Path>>(path: P) -> Result<DocumentAst, String> {
    let epub = crate::engine::epub::parse_epub(path)?;
    let mut sections = Vec::new();

    for chapter in epub.chapters {
        let mut nodes = Vec::new();
        nodes.push(AstNode::Heading {
            level: 2,
            text: chapter.title.clone(),
        });

        // Split HTML text nodes or paragraphs roughly
        let text_clean = chapter.content
            .replace("<p>", "\n\n")
            .replace("</p>", "")
            .replace("<br/>", "\n")
            .replace("<br>", "\n");

        for chunk in text_clean.split("\n\n") {
            let trimmed = chunk.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('<') {
                nodes.push(AstNode::Paragraph {
                    text: trimmed.to_string(),
                });
            }
        }

        sections.push(AstSection {
            title: chapter.title,
            nodes,
        });
    }

    Ok(DocumentAst {
        metadata: AstMetadata {
            title: epub.metadata.title,
            authors: epub.metadata.creators,
            language: epub.metadata.language,
            identifier: None,
        },
        sections,
    })
}

/// Emit Document AST to Plain Text / Markdown
pub fn emit_ast_to_markdown<P: AsRef<Path>>(ast: &DocumentAst, output_path: P) -> Result<(), String> {
    let mut file = File::create(output_path.as_ref()).map_err(|e| format!("Failed to create file: {}", e))?;

    writeln!(file, "# {}\n", ast.metadata.title).map_err(|e| e.to_string())?;
    if !ast.metadata.authors.is_empty() {
        writeln!(file, "*{}\n*", ast.metadata.authors.join(", ")).map_err(|e| e.to_string())?;
    }

    for section in &ast.sections {
        for node in &section.nodes {
            match node {
                AstNode::Heading { level, text } => {
                    let prefix = "#".repeat(*level as usize);
                    writeln!(file, "{} {}\n", prefix, text).map_err(|e| e.to_string())?;
                }
                AstNode::Paragraph { text } => {
                    writeln!(file, "{}\n", text).map_err(|e| e.to_string())?;
                }
                AstNode::Blockquote { text } => {
                    writeln!(file, "> {}\n", text).map_err(|e| e.to_string())?;
                }
                AstNode::CodeBlock { language, code } => {
                    let lang = language.as_deref().unwrap_or("");
                    writeln!(file, "```{}\n{}\n```\n", lang, code).map_err(|e| e.to_string())?;
                }
                AstNode::PageBreak => {
                    writeln!(file, "---\n").map_err(|e| e.to_string())?;
                }
            }
        }
    }

    Ok(())
}

/// Emit Document AST to Clean HTML5
pub fn emit_ast_to_html<P: AsRef<Path>>(ast: &DocumentAst, output_path: P) -> Result<(), String> {
    let mut file = File::create(output_path.as_ref()).map_err(|e| format!("Failed to create file: {}", e))?;

    writeln!(
        file,
        r#"<!DOCTYPE html>
<html lang="{}">
<head>
<meta charset="utf-8">
<title>{}</title>
<style>
body {{ font-family: 'Spectral', Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; background: #FFFDF9; color: #1C1917; }}
h1, h2, h3 {{ font-family: sans-serif; }}
</style>
</head>
<body>
<h1>{}</h1>
<p><em>{}</em></p>
<hr/>"#,
        ast.metadata.language,
        ast.metadata.title,
        ast.metadata.title,
        ast.metadata.authors.join(", ")
    ).map_err(|e| e.to_string())?;

    for section in &ast.sections {
        for node in &section.nodes {
            match node {
                AstNode::Heading { level, text } => {
                    writeln!(file, "<h{}>{}</h{}>", level, text, level).map_err(|e| e.to_string())?;
                }
                AstNode::Paragraph { text } => {
                    writeln!(file, "<p>{}</p>", text).map_err(|e| e.to_string())?;
                }
                AstNode::Blockquote { text } => {
                    writeln!(file, "<blockquote>{}</blockquote>", text).map_err(|e| e.to_string())?;
                }
                AstNode::CodeBlock { language: _, code } => {
                    writeln!(file, "<pre><code>{}</code></pre>", code).map_err(|e| e.to_string())?;
                }
                AstNode::PageBreak => {
                    writeln!(file, "<hr/>").map_err(|e| e.to_string())?;
                }
            }
        }
    }

    writeln!(file, "</body>\n</html>").map_err(|e| e.to_string())?;
    Ok(())
}

/// Convert any supported book document to target format (MD, HTML, TXT)
pub fn convert_book_document<P: AsRef<Path>, Q: AsRef<Path>>(
    source_path: P,
    target_format: &str,
    output_path: Q,
) -> Result<(), String> {
    let s_path = source_path.as_ref();
    let ext = s_path.extension().and_then(|s| s.to_str()).unwrap_or("").to_uppercase();

    let ast = match ext.as_str() {
        "EPUB" => parse_epub_to_ast(s_path)?,
        "TXT" => parse_text_to_ast(s_path)?,
        _ => return Err(format!("Direct AST conversion not yet supported for format .{}", ext)),
    };

    match target_format.to_uppercase().as_str() {
        "MD" | "MARKDOWN" => emit_ast_to_markdown(&ast, output_path),
        "HTML" | "HTM" => emit_ast_to_html(&ast, output_path),
        "TXT" => emit_ast_to_markdown(&ast, output_path), // markdown is clean text
        _ => Err(format!("Unsupported target format: {}", target_format)),
    }
}
