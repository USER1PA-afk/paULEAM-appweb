"use client";

import { type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@shared/lib/utils";

export type SegmentedColor =
  | "blue"
  | "purple"
  | "amber"
  | "teal"
  | "brand"
  | "zinc"
  | "accent";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  color?: SegmentedColor;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
  /**
   * On screens below `xl` (1280px) show prev/next arrows on each side of the
   * strip so the user can step through the full list. On `xl+` the arrows are
   * hidden because the entire strip fits. The strip itself adapts per
   * breakpoint via the `.segmented-strip` styles in `globals.css`:
   *   - `< md` (mobile, <768px): only the active option is rendered
   *   - `md → xl` (tablet, 768-1279px): first 5 options; the 6th slides in
   *     when it becomes active
   *   - `xl+` (laptop, ≥1280px): all options
   * Default: true.
   */
  mobileArrows?: boolean;
}

const colorMap: Record<SegmentedColor, { active: string; icon: string }> = {
  blue:   { active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   icon: "text-blue-600 dark:text-blue-400" },
  purple: { active: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: "text-purple-600 dark:text-purple-400" },
  amber:  { active: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400" },
  teal:   { active: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",   icon: "text-teal-600 dark:text-teal-400" },
  brand:  { active: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400", icon: "text-brand-600 dark:text-brand-400" },
  zinc:   { active: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",      icon: "text-zinc-500 dark:text-zinc-400" },
  accent: { active: "bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400", icon: "text-accent-600 dark:text-accent-400" },
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
  ariaLabel,
  mobileArrows = true,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < options.length - 1;

  function step(delta: number) {
    const next = options[activeIndex + delta];
    if (next) onChange(next.value);
  }

  const arrowBtn =
    "shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={cn("flex items-center justify-center gap-1.5 xl:justify-start", className)}>
      {mobileArrows && (
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label="Opción anterior"
          className={cn(arrowBtn, "h-8 w-8 xl:hidden")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        role="tablist"
        aria-label={ariaLabel}
        data-active={value}
        className="segmented-strip inline-flex min-w-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {options.map((opt, idx) => {
          const Icon = opt.icon;
          const isActive = opt.value === value;
          const colors = opt.color ? colorMap[opt.color] : null;
          return (
            <button
              // Force remount of the active button when `value` changes so the
              // fade-in animation re-plays on every segment switch.
              key={isActive ? `active-${value}` : opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-index={idx}
              onClick={() => onChange(opt.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
                isActive
                  ? cn("shadow-sm", colors?.active ?? "bg-background text-foreground", "animate-segmented-fade")
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
                    isActive ? colors?.icon : "text-current"
                  )}
                />
              )}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {mobileArrows && (
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-label="Opción siguiente"
          className={cn(arrowBtn, "h-8 w-8 xl:hidden")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
