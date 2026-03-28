import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { SeriesMeta } from "@/components/series-meta";
import { Badge } from "@/components/ui/badge";
import type { DiscoverSection } from "@/hooks/use-source-discover";

type SeriesCardItem = DiscoverSection["items"][number];

interface SeriesCardProps {
  item: SeriesCardItem;
}

export const SeriesCard = ({ item }: SeriesCardProps) => {
  return (
    <Link
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground transition-colors hover:border-primary/40"
      params={{ sourceId: item.sourceId, seriesId: item.seriesId }}
      to="/series/$sourceId/$seriesId"
    >
      <div className="aspect-[3/4] overflow-hidden border-b bg-muted">
        {item.coverImageUrl ? (
          <img
            alt={item.title}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            height={960}
            src={item.coverImageUrl}
            width={720}
          />
        ) : (
          <div className="flex size-full items-center justify-center px-6 text-center font-heading text-lg text-muted-foreground">
            {item.title}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-medium leading-snug">
              {item.title}
            </h3>
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
          <SeriesMeta
            contentRating={item.contentRating}
            language={item.originalLanguage}
            latestChapter={item.latestChapter}
            status={item.status}
          />
          <p className="line-clamp-3 text-muted-foreground text-sm">
            {item.description ??
              "Open this series to see chapters, metadata, and queue options."}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
};
