import { db } from "@mangy/db";
import {
  downloadDestination,
  libraryEntry,
  series,
  trackedSeriesState,
} from "@mangy/db/schema";
import { env } from "@mangy/env";
import { and, desc, eq, inArray } from "drizzle-orm";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

const getTrackingPollIntervalMs = (): number => {
  const intervalMs = Number(env.TRACKING_POLL_INTERVAL_MS);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return 900_000;
  }

  return intervalMs;
};

const createEmptySeriesState = (sourceId: string, seriesId: string) => ({
  libraryEntryId: null,
  sourceId,
  seriesId,
  isTracked: false,
  autoDownload: false,
  downloadDestinationId: null,
  downloadDestinationName: null,
  trackingState: null,
});

const serializeSeriesState = (row: {
  libraryEntryId: string | null;
  sourceId: string;
  seriesId: string;
  isTracked: boolean | null;
  autoDownload: boolean | null;
  downloadDestinationId: string | null;
  downloadDestinationName: string | null;
  trackingStateId: string | null;
  nextCheckAt: Date | null;
  lastCheckedAt: Date | null;
  lastSeenChapterExternalId: string | null;
  checkFailureCount: number | null;
}) => ({
  libraryEntryId: row.libraryEntryId,
  sourceId: row.sourceId,
  seriesId: row.seriesId,
  isTracked: row.isTracked ?? false,
  autoDownload: row.autoDownload ?? false,
  downloadDestinationId: row.downloadDestinationId,
  downloadDestinationName: row.downloadDestinationName,
  trackingState: row.trackingStateId
    ? {
        id: row.trackingStateId,
        nextCheckAt: row.nextCheckAt ? row.nextCheckAt.toISOString() : null,
        lastCheckedAt: row.lastCheckedAt
          ? row.lastCheckedAt.toISOString()
          : null,
        lastSeenChapterExternalId: row.lastSeenChapterExternalId ?? null,
        checkFailureCount: row.checkFailureCount ?? 0,
      }
    : null,
});

export const LibraryService = {
  async list(userId: string) {
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
  },

  async getSeriesState(userId: string, sourceId: string, seriesId: string) {
    const row = await LibraryService.getSeriesStateRow(
      userId,
      sourceId,
      seriesId
    );

    if (!row) {
      return createEmptySeriesState(sourceId, seriesId);
    }

    return serializeSeriesState(row);
  },

  async updateSeriesState(
    userId: string,
    input: {
      sourceId: string;
      seriesId: string;
      isTracked: boolean;
      autoDownload: boolean;
      downloadDestinationId?: string | null;
    }
  ) {
    const seriesRecord = await LibraryService.resolveSeriesRecord(
      input.sourceId,
      input.seriesId
    );
    const existingState = await LibraryService.getSeriesState(
      userId,
      input.sourceId,
      input.seriesId
    );

    const isTracked = input.isTracked || input.autoDownload;
    const downloadDestinationId = await LibraryService.resolveDestinationId(
      userId,
      input.downloadDestinationId,
      existingState.downloadDestinationId
    );

    if (input.autoDownload && !downloadDestinationId) {
      throw new Error("Choose a destination before enabling auto-download.");
    }

    const [entry] = await db
      .insert(libraryEntry)
      .values({
        autoDownload: input.autoDownload,
        downloadDestinationId,
        isTracked,
        seriesId: seriesRecord.id,
        userId,
      })
      .onConflictDoUpdate({
        target: [libraryEntry.userId, libraryEntry.seriesId],
        set: {
          autoDownload: input.autoDownload,
          downloadDestinationId,
          isTracked,
          updatedAt: new Date(),
        },
      })
      .returning({ id: libraryEntry.id });

    if (!entry) {
      throw new Error("Unable to update the library entry for this series.");
    }

    if (isTracked) {
      await LibraryService.upsertTrackedState({
        hadTrackingState: Boolean(existingState.trackingState),
        isAlreadyTracked: existingState.isTracked,
        libraryEntryId: entry.id,
        seriesExternalId: input.seriesId,
        seriesRecordId: seriesRecord.id,
        sourceId: input.sourceId,
      });
    } else {
      await db
        .delete(trackedSeriesState)
        .where(eq(trackedSeriesState.libraryEntryId, entry.id));
    }

    return LibraryService.getSeriesState(
      userId,
      input.sourceId,
      input.seriesId
    );
  },

  async getSeriesStateRow(userId: string, sourceId: string, seriesId: string) {
    const [row] = await db
      .select({
        libraryEntryId: libraryEntry.id,
        sourceId: series.sourceId,
        seriesId: series.externalId,
        isTracked: libraryEntry.isTracked,
        autoDownload: libraryEntry.autoDownload,
        downloadDestinationId: downloadDestination.id,
        downloadDestinationName: downloadDestination.name,
        trackingStateId: trackedSeriesState.id,
        nextCheckAt: trackedSeriesState.nextCheckAt,
        lastCheckedAt: trackedSeriesState.lastCheckedAt,
        lastSeenChapterExternalId: trackedSeriesState.lastSeenChapterExternalId,
        checkFailureCount: trackedSeriesState.checkFailureCount,
      })
      .from(series)
      .leftJoin(
        libraryEntry,
        and(
          eq(libraryEntry.seriesId, series.id),
          eq(libraryEntry.userId, userId)
        )
      )
      .leftJoin(
        downloadDestination,
        eq(libraryEntry.downloadDestinationId, downloadDestination.id)
      )
      .leftJoin(
        trackedSeriesState,
        eq(trackedSeriesState.libraryEntryId, libraryEntry.id)
      )
      .where(
        and(eq(series.sourceId, sourceId), eq(series.externalId, seriesId))
      )
      .orderBy(desc(trackedSeriesState.updatedAt))
      .limit(1);

    return row ?? null;
  },

  async resolveSeriesRecord(sourceId: string, seriesId: string) {
    const existingRecord = await SourcesStorage.findSeriesRecord(
      sourceId,
      seriesId
    );
    if (existingRecord) {
      return existingRecord;
    }

    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const seriesItem = await adapter.getSeries(seriesId);
    return SourcesStorage.upsertSeriesItem(sourceId, seriesItem);
  },

  async resolveDestinationId(
    userId: string,
    requestedDestinationId: string | null | undefined,
    existingDestinationId: string | null
  ) {
    const destinationId =
      requestedDestinationId === undefined
        ? existingDestinationId
        : requestedDestinationId;

    if (!destinationId) {
      return null;
    }

    const [destination] = await db
      .select({
        id: downloadDestination.id,
        isEnabled: downloadDestination.isEnabled,
      })
      .from(downloadDestination)
      .where(
        and(
          eq(downloadDestination.id, destinationId),
          eq(downloadDestination.userId, userId)
        )
      )
      .limit(1);

    if (!destination?.isEnabled) {
      throw new Error("The selected destination is missing or disabled.");
    }

    return destination.id;
  },

  async upsertTrackedState(input: {
    hadTrackingState: boolean;
    isAlreadyTracked: boolean;
    libraryEntryId: string;
    seriesExternalId: string;
    seriesRecordId: string;
    sourceId: string;
  }) {
    const currentRows = await db
      .select({
        id: trackedSeriesState.id,
        nextCheckAt: trackedSeriesState.nextCheckAt,
      })
      .from(trackedSeriesState)
      .where(eq(trackedSeriesState.libraryEntryId, input.libraryEntryId))
      .orderBy(desc(trackedSeriesState.updatedAt));
    const [primaryState, ...duplicateStates] = currentRows;
    const duplicateIds = duplicateStates.map((state) => state.id);

    if (!(input.isAlreadyTracked && input.hadTrackingState)) {
      const adapter = SourcesService.getSourceOrThrow(input.sourceId);
      const chapters = await adapter.getChapters(input.seriesExternalId);
      await SourcesStorage.upsertChapters(input.seriesRecordId, chapters);

      const now = new Date();
      const nextCheckAt = new Date(now.getTime() + getTrackingPollIntervalMs());

      if (primaryState) {
        await db
          .update(trackedSeriesState)
          .set({
            checkFailureCount: 0,
            lastCheckedAt: now,
            lastSeenChapterExternalId: chapters[0]?.externalId ?? null,
            nextCheckAt,
            updatedAt: now,
          })
          .where(eq(trackedSeriesState.id, primaryState.id));
      } else {
        await db.insert(trackedSeriesState).values({
          checkFailureCount: 0,
          lastCheckedAt: now,
          lastSeenChapterExternalId: chapters[0]?.externalId ?? null,
          libraryEntryId: input.libraryEntryId,
          nextCheckAt,
        });
      }

      if (duplicateIds.length > 0) {
        await db
          .delete(trackedSeriesState)
          .where(inArray(trackedSeriesState.id, duplicateIds));
      }

      return;
    }

    if (duplicateIds.length > 0) {
      await db
        .delete(trackedSeriesState)
        .where(inArray(trackedSeriesState.id, duplicateIds));
    }
  },
};
