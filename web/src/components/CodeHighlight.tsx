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
 * Lightweight, zero-dependency syntax highlighter for Swift and Web code samples.
 */
export function CodeHighlight({ code }: { code: string; language?: string }): ReactNode {
  const tokens = useMemo(() => tokenize(code), [code]);

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
