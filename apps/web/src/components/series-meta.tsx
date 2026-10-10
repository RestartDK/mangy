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
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs [&>span]:capitalize">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </p>
  );
};
