import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  action,
  breadcrumb,
  className,
  description,
  meta,
  title,
}: PageHeaderProps) => {
  return (
    <header className={cn("page-section", className)}>
      {breadcrumb ? <div>{breadcrumb}</div> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-muted-foreground text-sm sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? <div>{meta}</div> : null}
    </header>
  );
};
