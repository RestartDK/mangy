import { cn } from "@/lib/utils";

interface SeriesCoverProps {
  alt?: string;
  className?: string;
  title: string;
  url: string | null;
}

export const SeriesCover = ({
  alt,
  className,
  title,
  url,
}: SeriesCoverProps) => (
  <div
    className={cn("bg-muted relative overflow-hidden rounded-lg", className)}
  >
    {url ? (
      <img
        alt={alt ?? title}
        className="size-full object-cover"
        decoding="async"
        height={1080}
        loading="lazy"
        src={url}
        width={720}
      />
    ) : (
      <div className="font-heading text-muted-foreground flex size-full items-center justify-center px-3 text-center text-xs">
        <span className="line-clamp-3">{title}</span>
      </div>
    )}
  </div>
);
