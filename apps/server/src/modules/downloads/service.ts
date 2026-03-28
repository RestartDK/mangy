import { db } from "@mangy/db";
import {
  chapter,
  downloadDestination,
  downloadJob,
  libraryEntry,
  series,
} from "@mangy/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

const activeJobStatuses = ["queued", "running", "retryableFailed"] as const;

const serializeJob = (row: {
  id: string;
  sourceId: string | null;
  seriesId: string | null;
  chapterId: string | null;
  status: "queued" | "running" | "retryableFailed" | "completed" | "cancelled";
  progressPercent: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  seriesTitle: string | null;
  chapterTitle: string | null;
  destinationName: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...row,
  completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const DownloadsService = {
  async list(userId: string) {
    const rows = await DownloadsService.baseQuery()
      .where(eq(downloadJob.userId, userId))
      .orderBy(desc(downloadJob.createdAt));

    return rows.map(serializeJob);
  },

  async enqueue(
    userId: string,
    input: {
      sourceId: string;
      seriesId: string;
      chapterId: string;
      downloadDestinationId?: string;
    }
  ) {
    const adapter = SourcesService.getSourceOrThrow(input.sourceId);
    const seriesItem = await adapter.getSeries(input.seriesId);
    const seriesRecord = await SourcesStorage.upsertSeriesItem(
      input.sourceId,
      seriesItem
    );

    const chapters = await adapter.getChapters(input.seriesId);
    await SourcesStorage.upsertChapters(seriesRecord.id, chapters);

    const [chapterRecord] = await db
      .select({ id: chapter.id })
      .from(chapter)
      .where(
        and(
          eq(chapter.seriesId, seriesRecord.id),
          eq(chapter.externalId, input.chapterId)
        )
      );

    if (!chapterRecord) {
      throw new Error(
        "This chapter is no longer available from the selected source."
      );
    }

    const destination = await DownloadsService.resolveDestination(
      userId,
      input.downloadDestinationId
    );

    const [existingJob] = await db
      .select({ id: downloadJob.id })
      .from(downloadJob)
      .where(
        and(
          eq(downloadJob.userId, userId),
          eq(downloadJob.chapterId, chapterRecord.id),
          inArray(downloadJob.status, activeJobStatuses)
        )
      )
      .limit(1);

    if (existingJob) {
      const job = await DownloadsService.getJob(userId, existingJob.id);
      if (!job) {
        throw new Error("The existing queued job could not be loaded.");
      }

      return serializeJob(job);
    }

    const [createdJob] = await db.transaction(async (tx) => {
      await tx
        .insert(libraryEntry)
        .values({
          downloadDestinationId: destination.id,
          seriesId: seriesRecord.id,
          userId,
        })
        .onConflictDoUpdate({
          target: [libraryEntry.userId, libraryEntry.seriesId],
          set: {
            downloadDestinationId: destination.id,
            updatedAt: new Date(),
          },
        });

      const [job] = await tx
        .insert(downloadJob)
        .values({
          chapterId: chapterRecord.id,
          downloadDestinationId: destination.id,
          progressPercent: 0,
          seriesId: seriesRecord.id,
          userId,
        })
        .returning({ id: downloadJob.id });

      return [job];
    });

    if (!createdJob) {
      throw new Error("Unable to create a queue job for this chapter.");
    }

    const job = await DownloadsService.getJob(userId, createdJob.id);
    if (!job) {
      throw new Error("The queued download could not be loaded.");
    }

    return serializeJob(job);
  },

  async cancel(userId: string, jobId: string) {
    const job = await DownloadsService.getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (job.status === "completed") {
      throw new Error("Completed jobs cannot be cancelled.");
    }

    if (job.status === "cancelled") {
      return serializeJob(job);
    }

    await db
      .update(downloadJob)
      .set({
        completedAt: null,
        errorMessage: null,
        leaseOwner: null,
        leasedAt: null,
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(downloadJob.userId, userId), eq(downloadJob.id, jobId)));

    const updatedJob = await DownloadsService.getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The cancelled queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  },

  async retry(userId: string, jobId: string) {
    const job = await DownloadsService.getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (!(job.status === "retryableFailed" || job.status === "cancelled")) {
      throw new Error("Only failed or cancelled jobs can be retried.");
    }

    const now = new Date();

    await db
      .update(downloadJob)
      .set({
        attempts: 0,
        completedAt: null,
        createdAt: now,
        errorMessage: null,
        leaseOwner: null,
        leasedAt: null,
        progressPercent: 0,
        startedAt: null,
        status: "queued",
        updatedAt: now,
      })
      .where(and(eq(downloadJob.userId, userId), eq(downloadJob.id, jobId)));

    const updatedJob = await DownloadsService.getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The retried queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  },

  async prioritize(userId: string, jobId: string) {
    const job = await DownloadsService.getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (!(job.status === "queued" || job.status === "retryableFailed")) {
      throw new Error("Only queued jobs can be moved to the front.");
    }

    const [earliestJob] = await db
      .select({ createdAt: downloadJob.createdAt })
      .from(downloadJob)
      .where(
        and(
          eq(downloadJob.userId, userId),
          inArray(downloadJob.status, activeJobStatuses)
        )
      )
      .orderBy(asc(downloadJob.createdAt))
      .limit(1);

    const createdAt = earliestJob
      ? new Date(earliestJob.createdAt.getTime() - 1000)
      : new Date(Date.now() - 1000);

    await db
      .update(downloadJob)
      .set({
        createdAt,
        updatedAt: new Date(),
      })
      .where(and(eq(downloadJob.userId, userId), eq(downloadJob.id, jobId)));

    const updatedJob = await DownloadsService.getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The reordered queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  },

  baseQuery() {
    return db
      .select({
        id: downloadJob.id,
        sourceId: series.sourceId,
        seriesId: series.externalId,
        chapterId: chapter.externalId,
        status: downloadJob.status,
        progressPercent: downloadJob.progressPercent,
        attempts: downloadJob.attempts,
        maxAttempts: downloadJob.maxAttempts,
        errorMessage: downloadJob.errorMessage,
        seriesTitle: series.title,
        chapterTitle: chapter.title,
        destinationName: downloadDestination.name,
        completedAt: downloadJob.completedAt,
        createdAt: downloadJob.createdAt,
        updatedAt: downloadJob.updatedAt,
      })
      .from(downloadJob)
      .leftJoin(series, eq(downloadJob.seriesId, series.id))
      .leftJoin(chapter, eq(downloadJob.chapterId, chapter.id))
      .leftJoin(
        downloadDestination,
        eq(downloadJob.downloadDestinationId, downloadDestination.id)
      );
  },

  async getJob(userId: string, jobId: string) {
    const [job] = await DownloadsService.baseQuery()
      .where(and(eq(downloadJob.userId, userId), eq(downloadJob.id, jobId)))
      .orderBy(desc(downloadJob.createdAt))
      .limit(1);

    return job ?? null;
  },

  async resolveDestination(
    userId: string,
    requestedDestinationId: string | undefined
  ) {
    const destinations = await db
      .select({
        id: downloadDestination.id,
        isDefault: downloadDestination.isDefault,
        isEnabled: downloadDestination.isEnabled,
      })
      .from(downloadDestination)
      .where(eq(downloadDestination.userId, userId));

    const enabledDestinations = destinations.filter(
      (destination) => destination.isEnabled
    );

    if (enabledDestinations.length === 0) {
      throw new Error(
        "Add an enabled download destination in Settings before queueing chapters."
      );
    }

    if (requestedDestinationId) {
      const explicitDestination = enabledDestinations.find(
        (destination) => destination.id === requestedDestinationId
      );

      if (!explicitDestination) {
        throw new Error("The selected destination is missing or disabled.");
      }

      return explicitDestination;
    }

    const defaultDestination =
      enabledDestinations.find((destination) => destination.isDefault) ??
      enabledDestinations[0];

    if (!defaultDestination) {
      throw new Error("No destination is available for this download.");
    }

    return defaultDestination;
  },
};
