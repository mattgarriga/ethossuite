// Maps the `tools.icon` string to an inline SVG. Unknown names fall back to a grid icon.
const PATHS: Record<string, string> = {
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  default: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
};

export function ToolIcon({ name, className }: { name: string | null; className?: string }) {
  const d = PATHS[name ?? ""] ?? PATHS.default;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
