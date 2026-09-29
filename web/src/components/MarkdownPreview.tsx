import { type ReactNode } from "react";
import { CodeHighlight } from "@/components/CodeHighlight";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Render inline markdown tokens: bold, italic, code, links, images.
 */
function renderInline(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  // Match images, links, inline code, bold, italic, raw URLs
  const regex =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*|__([^_]+)__)|(\*([^*]+)\*|_([^_]+)_)|(https?:\/\/[^\s<]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Image: ![alt](url)
      elements.push(
        <img
          key={key++}
          src={match[3]}
          alt={match[2] || "Image"}
          className="my-2 max-h-64 rounded-lg border border-neutral-200 shadow-2xs block"
          loading="lazy"
        />,
      );
    } else if (match[4]) {
      // Link: [text](url)
      elements.push(
        <a
          key={key++}
          href={match[6]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {match[5]}
        </a>,
      );
    } else if (match[7]) {
      // Inline code: `code`
      elements.push(
        <code
          key={key++}
          className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-800 border border-neutral-200/80"
        >
          {match[8]}
        </code>,
      );
    } else if (match[9]) {
      // Bold: **text** or __text__
      elements.push(
        <strong key={key++} className="font-semibold text-neutral-900">
          {match[10] || match[11]}
        </strong>,
      );
    } else if (match[12]) {
      // Italic: *text* or _text_
      elements.push(
        <em key={key++} className="italic text-neutral-700">
          {match[13] || match[14]}
        </em>,
      );
    } else if (match[15]) {
      // Raw URL
      elements.push(
        <a
          key={key++}
          href={match[15]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {match[15]}
        </a>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

export function MarkdownPreview({ content, className = "" }: MarkdownPreviewProps) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(
        <div key={key++} className="my-2.5 overflow-hidden rounded-lg border border-neutral-800 bg-[#0d1117] shadow-sm">
          {lang ? (
            <div className="flex items-center justify-between border-b border-neutral-800/80 bg-[#161b22] px-3 py-1 text-[10px] font-mono text-neutral-400">
              <span>{lang}</span>
            </div>
          ) : null}
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-100">
            <CodeHighlight code={codeLines.join("\n")} language={lang} />
          </pre>
        </div>,
      );
      continue;
    }

    // Markdown Table
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        const rowLines = tableLines.slice(2); // skip separator |---|
        nodes.push(
          <div key={key++} className="my-2.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-700">
                <tr>
                  {headerCells.map((h, ci) => (
                    <th key={ci} className="px-3 py-2 font-semibold">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {rowLines.map((row, ri) => {
                  const cells = row
                    .split("|")
                    .slice(1, -1)
                    .map((c) => c.trim());
                  return (
                    <tr key={ri} className="hover:bg-neutral-50/50">
                      {cells.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    // Horizontal Rule (---, ***, ___)
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      nodes.push(
        <div key={key++} className="my-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="font-mono text-[9px] text-neutral-400 select-none">---</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>,
      );
      i++;
      continue;
    }

    // Heading 1 (# )
    if (line.startsWith("# ")) {
      nodes.push(
        <div key={key++} className="mt-4 mb-2 flex items-center gap-2 border-b border-neutral-200 pb-1.5">
          <span className="rounded bg-purple-100 px-1 py-0.2 font-mono text-[10px] font-bold text-purple-700 shadow-2xs">
            #
          </span>
          <h1 className="text-sm font-bold text-neutral-900 tracking-tight">{renderInline(line.slice(2))}</h1>
        </div>,
      );
      i++;
      continue;
    }

    // Heading 2 (## ) - Syntax highlighted section header!
    if (line.startsWith("## ")) {
      nodes.push(
        <div
          key={key++}
          className="mt-4 mb-2 flex items-center gap-2 rounded-r-md border-l-2 border-blue-500 bg-blue-50/50 px-2.5 py-1"
        >
          <span className="rounded bg-blue-100 px-1 py-0.2 font-mono text-[10px] font-bold text-blue-700 shadow-2xs">
            ##
          </span>
          <h2 className="text-xs font-bold text-neutral-900 tracking-wide uppercase">{renderInline(line.slice(3))}</h2>
        </div>,
      );
      i++;
      continue;
    }

    // Heading 3 (### ) - Subheading with syntax marker
    if (line.startsWith("### ")) {
      nodes.push(
        <div key={key++} className="mt-3 mb-1 flex items-center gap-1.5">
          <span className="rounded bg-neutral-100 px-1 py-0.2 font-mono text-[10px] font-semibold text-neutral-500 shadow-2xs">
            ###
          </span>
          <h3 className="text-xs font-semibold text-neutral-800">{renderInline(line.slice(4))}</h3>
        </div>,
      );
      i++;
      continue;
    }

    // Heading 4 (#### )
    if (line.startsWith("#### ")) {
      nodes.push(
        <div key={key++} className="mt-2.5 mb-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-medium text-neutral-400">####</span>
          <h4 className="text-xs font-medium text-neutral-700">{renderInline(line.slice(5))}</h4>
        </div>,
      );
      i++;
      continue;
    }

    // Blockquote (> )
    if (line.startsWith("> ")) {
      nodes.push(
        <blockquote
          key={key++}
          className="my-1.5 rounded-r border-l-2 border-neutral-300 bg-neutral-50/60 py-1 pl-3 text-xs italic text-neutral-600"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      i++;
      continue;
    }

    // Task list item (- [ ] or - [x])
    const taskMatch = line.trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === "x";
      nodes.push(
        <div key={key++} className="ml-2 flex items-center gap-2 py-0.5 text-xs text-neutral-700">
          <span
            className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-bold ${
              isChecked
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-neutral-300 bg-white text-transparent"
            }`}
          >
            ✓
          </span>
          <div className="flex-1 min-w-0 leading-relaxed">{renderInline(taskMatch[2])}</div>
        </div>,
      );
      i++;
      continue;
    }

    // Unordered List item (- or * )
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      nodes.push(
        <div key={key++} className="ml-2 flex items-start gap-2 py-0.5 text-xs text-neutral-700">
          <span className="font-mono text-neutral-400 font-bold select-none">•</span>
          <div className="flex-1 min-w-0 leading-relaxed">{renderInline(line.trim().slice(2))}</div>
        </div>,
      );
      i++;
      continue;
    }

    // Ordered List item (1. )
    const olMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      nodes.push(
        <div key={key++} className="ml-2 flex items-start gap-2 py-0.5 text-xs text-neutral-700">
          <span className="font-mono text-[11px] font-medium text-neutral-400">{olMatch[1]}.</span>
          <div className="flex-1 min-w-0 leading-relaxed">{renderInline(olMatch[2])}</div>
        </div>,
      );
      i++;
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={key++} className="h-1.5" />);
      i++;
      continue;
    }

    // Regular Paragraph
    nodes.push(
      <p key={key++} className="my-1 text-xs text-neutral-800 leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return (
    <div className={`overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3.5 ${className}`}>
      {nodes}
    </div>
  );
}
