import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, FileText } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SeriesChapter } from "@/hooks/use-series-detail";
import { formatDate } from "@/lib/format";

interface ChapterListItemProps {
  chapter: SeriesChapter;
  canQueue: boolean;
  isPending: boolean;
  onQueue: (chapterId: string) => void;
  seriesId: string;
  sourceId: string;
}

export const ChapterListItem = ({
  canQueue,
  chapter,
  isPending,
  onQueue,
  seriesId,
  sourceId,
}: ChapterListItemProps) => {
  const title = chapter.chapterNumber
    ? `Chapter ${chapter.chapterNumber}`
    : "Special chapter";
  let queueHelper = "Choose a download destination before queueing chapters.";

  if (chapter.isUnavailable) {
    queueHelper = "This chapter is not available from the source right now.";
  } else if (canQueue) {
    queueHelper = "Ready to queue to your selected destination.";
  }

  return (
    <Card size="sm">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>
              {chapter.title ? `${title}: ${chapter.title}` : title}
            </CardTitle>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(chapter.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" />
                {chapter.pageCount
                  ? `${chapter.pageCount} pages`
                  : "Page count unavailable"}
              </span>
            </div>
          </div>
          <StatusBadge
            tone={chapter.isUnavailable ? "destructive" : "secondary"}
          >
            {chapter.isUnavailable ? "Unavailable" : "Ready"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{queueHelper}</p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        {chapter.isUnavailable ? (
          <Button className="w-full" disabled type="button" variant="outline">
            <BookOpen className="size-4" />
            Read
          </Button>
        ) : (
          <Button asChild className="w-full" type="button" variant="outline">
            <Link
              params={{
                chapterId: chapter.chapterId,
                seriesId,
                sourceId,
              }}
              to="/series/$sourceId/$seriesId/read/$chapterId"
            >
              <BookOpen className="size-4" />
              Read
            </Link>
          </Button>
        )}
        <Button
          className="w-full"
          disabled={chapter.isUnavailable || !canQueue || isPending}
          onClick={() => onQueue(chapter.chapterId)}
          type="button"
        >
          {isPending ? "Queueing..." : "Queue chapter"}
        </Button>
      </CardFooter>
    </Card>
  );
};
