interface LogomarkProps {
  size?: number;
  className?: string;
}

/** Inline rendition of branding/feedbackkit-logo.svg, sized for UI chrome. */
export function Logomark({ size = 28, className = "" }: LogomarkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="FeedbackKit"
    >
      <rect x="0" y="0" width="512" height="512" rx="112" fill="#171717" />
      <path d="M 176 325 L 150 392 L 226 325 Z" fill="#ffffff" />
      <rect x="116" y="120" width="280" height="220" rx="60" fill="#ffffff" />
      <rect x="238" y="160" width="36" height="92" rx="18" fill="#171717" />
      <circle cx="256" cy="282" r="20" fill="#171717" />
    </svg>
  );
}
