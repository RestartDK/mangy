import type { PropsWithChildren } from "react";

interface PlaceholderPanelProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  description: string;
}

export const PlaceholderPanel = ({
  children,
  description,
  eyebrow,
  title,
}: PlaceholderPanelProps) => (
  <section className="panelSurface p-6 md:p-8">
    <div className="eyebrow">{eyebrow}</div>
    <h2 className="mt-3 font-display text-3xl text-primary">{title}</h2>
    <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
    <div className="mt-6">{children}</div>
  </section>
);
