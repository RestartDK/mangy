import type { DiscoverSection } from "@/hooks/useSourceDiscover";

import { SeriesCard } from "./seriesCard";

interface SectionShelfProps {
  section: DiscoverSection;
}

export const SectionShelf = ({ section }: SectionShelfProps) => (
  <section className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="eyebrow">{section.type}</div>
        <h2 className="mt-2 font-display text-3xl text-primary">
          {section.title}
        </h2>
      </div>
      <div className="text-muted-foreground text-sm">
        {section.items.length} picks loaded
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {section.items.map((item) => (
        <SeriesCard item={item} key={`${item.sourceId}:${item.seriesId}`} />
      ))}
    </div>
  </section>
);
