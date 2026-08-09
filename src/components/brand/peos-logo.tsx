import { cn } from "@/lib/utils";

/**
 * The peos mark — matches `src/app/icon.svg` (dark rounded square, "pe",
 * teal dot). Renders at the given size; optionally pairs with the wordmark.
 */
export function PeosLogo({
  className,
  withWordmark = false,
  iconClassName,
}: {
  className?: string;
  withWordmark?: boolean;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 512 512"
        className={cn("size-6 shrink-0", iconClassName)}
        aria-hidden="true"
        role="img"
      >
        <rect width="512" height="512" rx="96" fill="#1c1c1c" />
        <text
          x="256"
          y="320"
          fontFamily="Geist, Arial, Helvetica, sans-serif"
          fontSize="220"
          fontWeight="600"
          textAnchor="middle"
          fill="#f5f5f5"
        >
          pe
        </text>
        <circle cx="392" cy="150" r="34" fill="#2f6f6f" />
      </svg>
      {withWordmark && (
        <span className="font-semibold tracking-tight">peos</span>
      )}
    </span>
  );
}
