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
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb ? <div className="pb-1">{breadcrumb}</div> : null}
        <h1 className="font-heading text-xl font-semibold tracking-tight break-words sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {action}
        </div>
      ) : null}
      {meta ? <div className="w-full">{meta}</div> : null}
    </header>
  );
};
