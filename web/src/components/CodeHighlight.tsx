import { useMemo, type ReactNode } from "react";

type TokenType =
  | "comment"
  | "string"
  | "keyword"
  | "type"
  | "param"
  | "function"
  | "property"
  | "identifier"
  | "number"
  | "punct"
  | "ws"
  | "plain";

interface Token {
  type: TokenType;
  text: string;
}

const TOKEN_REGEX =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`)|(\b(?:import|export|from|as|const|let|var|function|func|return|if|else|switch|case|default|class|struct|enum|protocol|extension|init|public|private|fileprivate|internal|open|static|override|true|false|null|undefined|nil|try|catch|throw|throws|await|async|self|Self|this|new|typeof|interface|type)\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|(\b[a-zA-Z_]\w*(?=\s*:))|(\b[a-zA-Z_]\w*(?=\s*[({]))|(\b[a-zA-Z_]\w*\b)|(\b\d+(?:\.\d+)?\b)|(\.)|(\s+)|([^\s\w]+)/g;

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  let prevNonWs: string | null = null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(code)) !== null) {
    const [, comment, str, kw, type, param, fn, ident, num, dot, ws, punct] = match;
    let tokenType: TokenType = "plain";
    const text = match[0];

    if (comment) tokenType = "comment";
    else if (str) tokenType = "string";
    else if (kw) tokenType = "keyword";
    else if (type) tokenType = "type";
    else if (param) tokenType = "param";
    else if (fn) tokenType = "function";
    else if (ident) {
      tokenType = prevNonWs === "." ? "property" : "identifier";
    } else if (num) tokenType = "number";
    else if (dot) tokenType = "punct";
    else if (ws) tokenType = "ws";
    else if (punct) tokenType = "punct";

    tokens.push({ type: tokenType, text });
    if (tokenType !== "ws") {
      prevNonWs = text;
    }
  }

  return tokens;
}

function tokenizeMarkdown(code: string): Token[] {
  const lines = code.split("\n");
  const tokens: Token[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) {
      tokens.push({ type: "ws", text: "\n" });
    }

    // Fenced code block markers
    if (line.trim().startsWith("```")) {
      const idx = line.indexOf("```");
      if (idx > 0) tokens.push({ type: "plain", text: line.slice(0, idx) });
      tokens.push({ type: "punct", text: "```" });
      const rest = line.slice(idx + 3);
      if (rest) tokens.push({ type: "type", text: rest });
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      const innerTokens = tokenize(line);
      tokens.push(...innerTokens);
      continue;
    }

    // Headings: # Heading
    const headingMatch = line.match(/^(\s*#{1,6}\s+)(.*)$/);
    if (headingMatch) {
      tokens.push({ type: "keyword", text: headingMatch[1] });
      tokens.push({ type: "function", text: headingMatch[2] });
      continue;
    }

    // Blockquote: > text
    const quoteMatch = line.match(/^(\s*>\s*)(.*)$/);
    if (quoteMatch) {
      tokens.push({ type: "punct", text: quoteMatch[1] });
      tokens.push({ type: "comment", text: quoteMatch[2] });
      continue;
    }

    // Horizontal rule: --- or ***
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      tokens.push({ type: "comment", text: line });
      continue;
    }

    // List bullet / number: - item or 1. item
    const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/);
    let contentToScan = line;
    if (listMatch) {
      tokens.push({ type: "keyword", text: listMatch[1] });
      contentToScan = listMatch[2];
    }

    // Inline formatting: bold, italic, code, links
    const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = inlineRegex.exec(contentToScan)) !== null) {
      if (m.index > lastIdx) {
        tokens.push({ type: "plain", text: contentToScan.slice(lastIdx, m.index) });
      }
      if (m[1]) {
        tokens.push({ type: "string", text: m[1] });
      } else if (m[2]) {
        tokens.push({ type: "type", text: m[2] });
      } else if (m[3]) {
        tokens.push({ type: "param", text: m[3] });
      } else if (m[4]) {
        tokens.push({ type: "function", text: m[4] });
      }
      lastIdx = inlineRegex.lastIndex;
    }
    if (lastIdx < contentToScan.length) {
      tokens.push({ type: "plain", text: contentToScan.slice(lastIdx) });
    }
  }

  return tokens;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  comment: "text-neutral-500 italic",
  string: "text-emerald-400",
  keyword: "text-purple-400 font-medium",
  type: "text-cyan-300 font-medium",
  function: "text-blue-400",
  property: "text-sky-300",
  param: "text-amber-200",
  number: "text-amber-400",
  punct: "text-neutral-400",
  identifier: "text-neutral-200",
  plain: "text-neutral-200",
  ws: "",
};

/**
 * Lightweight, zero-dependency syntax highlighter for Swift, Web, and Markdown code samples.
 */
export function CodeHighlight({ code, language }: { code: string; language?: string }): ReactNode {
  const tokens = useMemo(() => {
    const lang = language?.toLowerCase().trim();
    if (lang === "markdown" || lang === "md") {
      return tokenizeMarkdown(code);
    }
    return tokenize(code);
  }, [code, language]);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === "ws") {
          return token.text;
        }
        return (
          <span key={index} className={TOKEN_CLASSES[token.type]}>
            {token.text}
          </span>
        );
      })}
    </>
  );
}
