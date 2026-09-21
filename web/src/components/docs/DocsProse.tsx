import type { ReactNode } from "react";
import { slugify } from "@/lib/slugify";

export function DocsTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-10">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{title}</h1>
      {description ? <p className="mt-3 text-sm text-neutral-600 sm:text-base">{description}</p> : null}
    </div>
  );
}

export function DocsSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  const sectionId = id || slugify(title);
  return (
    <section id={sectionId} className="mt-10 scroll-mt-24 first:mt-0">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export function DocsCallout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`rounded-md border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function DocsList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function DocsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-neutral-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="break-words rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] text-neutral-800">
      {children}
    </code>
  );
}
