import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  brand: "text-brand-strong",
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  brand: "bg-brand",
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
}: StatusBadgeProps) => {
  return (
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
};
