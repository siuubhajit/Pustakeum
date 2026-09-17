use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentAst {
    pub metadata: AstMetadata,
    pub sections: Vec<AstSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstMetadata {
    pub title: String,
    pub authors: Vec<String>,
    pub language: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstSection {
    pub title: String,
    pub nodes: Vec<AstNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AstNode {
    Heading { level: u8, text: String },
    Paragraph { text: String },
    Blockquote { text: String },
    CodeBlock { language: Option<String>, code: String },
    PageBreak,
}

