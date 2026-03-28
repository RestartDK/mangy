import { db } from "@mangy/db";
import {
  chapter,
  downloadDestination,
  downloadJob,
  series,
} from "@mangy/db/schema";
import { desc, eq } from "drizzle-orm";

export abstract class DownloadsService {
  static async list(userId: string) {
    const rows = await db
      .select({
        id: downloadJob.id,
        status: downloadJob.status,
        progressPercent: downloadJob.progressPercent,
        attempts: downloadJob.attempts,
        maxAttempts: downloadJob.maxAttempts,
        errorMessage: downloadJob.errorMessage,
        seriesTitle: series.title,
        chapterTitle: chapter.title,
        destinationName: downloadDestination.name,
        createdAt: downloadJob.createdAt,
        updatedAt: downloadJob.updatedAt,
      })
      .from(downloadJob)
      .leftJoin(series, eq(downloadJob.seriesId, series.id))
      .leftJoin(chapter, eq(downloadJob.chapterId, chapter.id))
      .leftJoin(
        downloadDestination,
        eq(downloadJob.downloadDestinationId, downloadDestination.id)
      )
      .where(eq(downloadJob.userId, userId))
      .orderBy(desc(downloadJob.createdAt));

    return rows.map((row) => ({
      ...row,
      errorMessage: row.errorMessage ?? null,
      seriesTitle: row.seriesTitle ?? null,
      chapterTitle: row.chapterTitle ?? null,
      destinationName: row.destinationName ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
