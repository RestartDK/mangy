import { Link } from "@tanstack/react-router";

import type { DiscoverSection } from "@/hooks/useSourceDiscover";

type SeriesCardItem = DiscoverSection["items"][number];

interface SeriesCardProps {
  item: SeriesCardItem;
}

export const SeriesCard = ({ item }: SeriesCardProps) => (
  <Link
    className="group block overflow-hidden rounded-[24px] border border-border/70 bg-card/85 shadow-[0_18px_50px_rgba(67,51,35,0.12)] transition-transform duration-200 hover:-translate-y-1"
    params={{ sourceId: item.sourceId, seriesId: item.seriesId }}
    to="/series/$sourceId/$seriesId"
  >
    <div className="aspect-[3/4] overflow-hidden bg-secondary/70">
      {item.coverImageUrl ? (
        <img
          alt={item.title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          height={960}
          src={item.coverImageUrl}
          width={720}
        />
      ) : (
        <div className="flex size-full items-center justify-center px-6 text-center font-display text-2xl text-muted-foreground">
          {item.title}
        </div>
      )}
    </div>
    <div className="space-y-3 p-4">
      <div>
        <div className="line-clamp-2 font-semibold text-base leading-tight">
          {item.title}
        </div>
        <div className="mt-1 text-muted-foreground text-sm">
          {item.latestChapter
            ? `Latest chapter ${item.latestChapter}`
            : item.status}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.tags.slice(0, 3).map((tag) => (
          <span
            className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground uppercase tracking-[0.14em]"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  </Link>
);
