import { Fragment } from "react";

/** Plain text where `backticked` spans render as inline code (for lib/loopHealth.ts copy). */
export function TextWithCode({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px] text-neutral-800">
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
