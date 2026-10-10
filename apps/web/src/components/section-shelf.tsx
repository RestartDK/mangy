import type { DiscoverSection } from "@/hooks/use-source-discover";

import { SeriesCard } from "./series-card";

interface SectionShelfProps {
  section: DiscoverSection;
}

const sectionLabelMap: Record<DiscoverSection["type"], string> = {
  popular: "Popular now",
  latest: "Latest updates",
  trending: "Trending",
};

export const SectionShelf = ({ section }: SectionShelfProps) => (
  <section className="page-section">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-muted-foreground text-sm">
          {sectionLabelMap[section.type]}
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {section.title}
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        {section.items.length} series
      </p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {section.items.map((item) => (
        <SeriesCard item={item} key={`${item.sourceId}:${item.seriesId}`} />
      ))}
    </div>
  </section>
);
