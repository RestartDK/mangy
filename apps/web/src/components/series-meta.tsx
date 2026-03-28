import { StatusBadge } from "@/components/status-badge";

interface SeriesMetaProps {
  status?: string | null;
  latestChapter?: string | null;
  language?: string | null;
  contentRating?: string | null;
}

export const SeriesMeta = ({
  contentRating,
  language,
  latestChapter,
  status,
}: SeriesMetaProps) => {
  const items = [
    latestChapter ? `Latest ${latestChapter}` : null,
    status ? status.replaceAll("-", " ") : null,
    language ? language.toUpperCase() : null,
    contentRating,
  ].filter((item): item is string => Boolean(item));

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <StatusBadge key={item}>{item}</StatusBadge>
      ))}
    </div>
  );
};
