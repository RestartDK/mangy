import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "default" | "secondary" | "outline" | "destructive";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export const StatusBadge = ({
  children,
  className,
  tone = "outline",
}: StatusBadgeProps) => {
  return (
    <Badge className={cn("capitalize", className)} variant={tone}>
      {children}
    </Badge>
  );
};
