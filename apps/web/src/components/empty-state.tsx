import { BookOpen, Download, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const iconMap = {
  library: BookOpen,
  search: Search,
  download: Download,
  default: BookOpen,
} as const;

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: keyof typeof iconMap;
  className?: string;
}

export const EmptyState = ({
  action,
  className,
  description,
  icon = "default",
  title,
}: EmptyStateProps) => {
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        "panel flex flex-col items-center gap-4 px-6 py-14 text-center",
        className
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium">{title}</p>
        <p className="meta mx-auto max-w-md">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
};
