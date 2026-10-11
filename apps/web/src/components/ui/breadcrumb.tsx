import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Breadcrumb = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    aria-label="breadcrumb"
    className={cn(className)}
    data-slot="breadcrumb"
    {...props}
  />
);

const BreadcrumbList = ({
  className,
  ...props
}: React.ComponentProps<"ol">) => (
  <ol
    className={cn(
      "text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs/relaxed wrap-break-word",
      className
    )}
    data-slot="breadcrumb-list"
    {...props}
  />
);

const BreadcrumbItem = ({
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    className={cn("inline-flex items-center gap-1", className)}
    data-slot="breadcrumb-item"
    {...props}
  />
);

const BreadcrumbLink = ({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) => {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      className={cn("hover:text-foreground transition-colors", className)}
      data-slot="breadcrumb-link"
      {...props}
    />
  );
};

const BreadcrumbPage = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-current="page"
    className={cn("text-foreground font-normal", className)}
    data-slot="breadcrumb-page"
    {...props}
  />
);

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    aria-hidden="true"
    className={cn("[&>svg]:size-3.5", className)}
    data-slot="breadcrumb-separator"
    role="presentation"
    {...props}
  >
    {children ?? <CaretRightIcon />}
  </li>
);

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex size-4 items-center justify-center [&>svg]:size-3.5",
      className
    )}
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    {...props}
  >
    <DotsThreeIcon />
    <span className="sr-only">More</span>
  </span>
);

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
