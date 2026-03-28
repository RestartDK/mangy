import { db } from "@mangy/db";
import { downloadDestination, libraryEntry, series } from "@mangy/db/schema";
import { desc, eq } from "drizzle-orm";

export abstract class LibraryService {
  static async list(userId: string) {
    const rows = await db
      .select({
        id: libraryEntry.id,
        sourceId: series.sourceId,
        seriesId: series.externalId,
        title: series.title,
        coverImageUrl: series.coverImageUrl,
        isTracked: libraryEntry.isTracked,
        autoDownload: libraryEntry.autoDownload,
        destinationName: downloadDestination.name,
        updatedAt: libraryEntry.updatedAt,
      })
      .from(libraryEntry)
      .innerJoin(series, eq(libraryEntry.seriesId, series.id))
      .leftJoin(
        downloadDestination,
        eq(libraryEntry.downloadDestinationId, downloadDestination.id)
      )
      .where(eq(libraryEntry.userId, userId))
      .orderBy(desc(libraryEntry.updatedAt));

    return rows.map((row) => ({
      ...row,
      destinationName: row.destinationName ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
