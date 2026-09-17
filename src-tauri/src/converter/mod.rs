pub mod ast;

use ast::{AstNode, AstSection, DocumentAst};
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
        metadata: ast::AstMetadata {
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

/// Emit Document AST to Plain Text / Markdown
pub fn emit_ast_to_markdown<P: AsRef<Path>>(ast: &DocumentAst, output_path: P) -> Result<(), String> {
    let mut file = File::create(output_path.as_ref()).map_err(|e| format!("Failed to create file: {}", e))?;

    writeln!(file, "# {}\n", ast.metadata.title).map_err(|e| e.to_string())?;

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

