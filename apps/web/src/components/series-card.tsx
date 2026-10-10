import { Link } from "@tanstack/react-router";

import { SeriesCover } from "@/components/series-cover";
import type { DiscoverSection } from "@/hooks/use-source-discover";

type SeriesCardItem = DiscoverSection["items"][number];

interface SeriesCardProps {
  item: SeriesCardItem;
}

export const SeriesCard = ({ item }: SeriesCardProps) => {
  return (
    <Link
      className="group focus-visible:ring-ring/40 flex flex-col gap-3 outline-none focus-visible:ring-2"
      params={{ sourceId: item.sourceId, seriesId: item.seriesId }}
      to="/series/$sourceId/$seriesId"
    >
      <SeriesCover
        className="group-hover:ring-brand/40 aspect-2/3 w-full transition-shadow group-hover:ring-2"
        title={item.title}
        url={item.coverImageUrl}
      />
      <div className="min-w-0 space-y-1.5">
        <h3 className="font-heading group-hover:text-foreground group-hover:decoration-brand line-clamp-2 text-sm leading-snug font-medium group-hover:underline group-hover:underline-offset-4">
          {item.title}
        </h3>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {item.status ? (
            <span className="capitalize">
              {item.status.replaceAll("-", " ")}
            </span>
          ) : null}
          {item.latestChapter ? <span>Latest {item.latestChapter}</span> : null}
        </div>
      </div>
    </Link>
  );
};
