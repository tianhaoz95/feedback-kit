import { useState } from "react";
import { Button } from "@/components/Button";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({
  text,
  label = "Copy",
  size = "sm",
  variant = "secondary",
}: {
  text: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "dark" | "primary";
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <CheckIcon
          className={`h-3.5 w-3.5 ${variant === "secondary" ? "text-emerald-600" : "text-emerald-400"}`}
        />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </Button>
  );
}
