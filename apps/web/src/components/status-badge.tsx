import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<StatusTone, string> = {
  brand: "text-brand-strong",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
};

const dotClasses: Record<StatusTone, string> = {
  brand: "bg-brand",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
};

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export const StatusBadge = ({
  children,
  className,
  tone = "neutral",
}: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium capitalize",
      toneClasses[tone],
      className
    )}
  >
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", dotClasses[tone])}
    />
    {children}
  </span>
);
