import { BookOpen, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const iconMap = {
  library: BookOpen,
  search: Search,
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
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
};
