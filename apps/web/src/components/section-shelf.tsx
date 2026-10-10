import type { DiscoverSection } from "@/hooks/use-source-discover";

import { SeriesCard } from "./series-card";

interface SectionShelfProps {
  section: DiscoverSection;
}

export const SectionShelf = ({ section }: SectionShelfProps) => (
  <section className="page-section">
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="font-heading text-base font-medium tracking-tight">
        {section.title}
      </h2>
      <span className="meta">{section.items.length} series</span>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {section.items.map((item) => (
        <SeriesCard item={item} key={`${item.sourceId}:${item.seriesId}`} />
      ))}
    </div>
  </section>
);
