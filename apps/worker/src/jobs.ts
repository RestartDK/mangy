import { db } from "@mangy/db";
import {
  chapter,
  downloadArtifact,
  downloadDestination,
  downloadJob,
  notification,
  series,
} from "@mangy/db/schema";
import { and, eq, sql } from "drizzle-orm";

export interface ClaimedDownloadJob {
  attempts: number;
  chapterExternalId: string | null;
  chapterNumber: string | null;
  chapterRecordId: string | null;
  chapterTitle: string | null;
  destinationName: string | null;
  destinationPath: string | null;
  id: string;
  maxAttempts: number;
  seriesSourceId: string | null;
  seriesTitle: string | null;
  userId: string;
}

interface CompletedArtifact {
  fileSizeBytes: number;
  outputPath: string;
}

const buildChapterLabel = (job: ClaimedDownloadJob): string => {
  if (job.chapterNumber && job.chapterTitle) {
    return `Chapter ${job.chapterNumber} - ${job.chapterTitle}`;
  }

  if (job.chapterNumber) {
    return `Chapter ${job.chapterNumber}`;
  }

  return job.chapterTitle ?? "Special chapter";
};

const buildDownloadTitle = (job: ClaimedDownloadJob): string =>
  job.seriesTitle ?? "Queued chapter";

export const claimNextDownloadJob = async (
  workerId: string
): Promise<ClaimedDownloadJob | null> => {
  const result = await db.execute(sql<{ id: string }>`
    update "download_job"
    set
      "status" = 'running',
      "lease_owner" = ${workerId},
      "leased_at" = now(),
      "started_at" = coalesce("started_at", now()),
      "attempts" = "attempts" + 1,
      "error_message" = null,
      "updated_at" = now()
    where "id" = (
      select "id"
      from "download_job"
      where (
        "status" = 'queued'
        or (
          "status" = 'retryableFailed'
          and "attempts" < "max_attempts"
          and "updated_at" <= now() - (interval '15 seconds' * power(2, greatest("attempts", 0)))
        )
      )
      and (
        "lease_owner" is null
        or "leased_at" is null
        or "leased_at" <= now() - interval '10 minutes'
      )
      order by "created_at" asc
      for update skip locked
      limit 1
    )
    returning "id";
  `);

  const claimedJobId = result.rows[0]?.id as string | undefined;
  if (!claimedJobId) {
    return null;
  }

  const [job] = await db
    .select({
      attempts: downloadJob.attempts,
      chapterExternalId: chapter.externalId,
      chapterNumber: chapter.chapterNumber,
      chapterRecordId: chapter.id,
      chapterTitle: chapter.title,
      destinationName: downloadDestination.name,
      destinationPath: downloadDestination.absolutePath,
      id: downloadJob.id,
      maxAttempts: downloadJob.maxAttempts,
      seriesSourceId: series.sourceId,
      seriesTitle: series.title,
      userId: downloadJob.userId,
    })
    .from(downloadJob)
    .leftJoin(series, eq(downloadJob.seriesId, series.id))
    .leftJoin(chapter, eq(downloadJob.chapterId, chapter.id))
    .leftJoin(
      downloadDestination,
      eq(downloadJob.downloadDestinationId, downloadDestination.id)
    )
    .where(eq(downloadJob.id, claimedJobId))
    .limit(1);

  return job ?? null;
};

export const updateDownloadJobProgress = async (
  jobId: string,
  progressPercent: number
): Promise<void> => {
  await db
    .update(downloadJob)
    .set({
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      updatedAt: new Date(),
    })
    .where(eq(downloadJob.id, jobId));
};

export const isDownloadJobCancelled = async (
  jobId: string
): Promise<boolean> => {
  const [job] = await db
    .select({ status: downloadJob.status })
    .from(downloadJob)
    .where(eq(downloadJob.id, jobId))
    .limit(1);

  return job?.status === "cancelled";
};

export const cancelRunningDownloadJob = async (
  jobId: string
): Promise<void> => {
  await db
    .update(downloadJob)
    .set({
      completedAt: null,
      errorMessage: null,
      leaseOwner: null,
      leasedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(downloadJob.id, jobId), eq(downloadJob.status, "cancelled")));
};

export const completeDownloadJob = async (
  job: ClaimedDownloadJob,
  artifact: CompletedArtifact
): Promise<void> => {
  const now = new Date();
  const chapterLabel = buildChapterLabel(job);

  await db.transaction(async (tx) => {
    await tx
      .update(downloadJob)
      .set({
        completedAt: now,
        errorMessage: null,
        leaseOwner: null,
        leasedAt: null,
        progressPercent: 100,
        status: "completed",
        updatedAt: now,
      })
      .where(eq(downloadJob.id, job.id));

    if (job.chapterRecordId) {
      await tx
        .update(chapter)
        .set({
          isDownloaded: true,
          updatedAt: now,
        })
        .where(eq(chapter.id, job.chapterRecordId));

      await tx.insert(downloadArtifact).values({
        chapterId: job.chapterRecordId,
        downloadJobId: job.id,
        fileSizeBytes: artifact.fileSizeBytes,
        outputPath: artifact.outputPath,
      });
    }

    await tx.insert(notification).values({
      body: `${chapterLabel} finished and was written to ${job.destinationName ?? "your destination"}.`,
      title: buildDownloadTitle(job),
      type: "downloadCompleted",
      userId: job.userId,
    });
  });
};

export const failDownloadJob = async (
  job: ClaimedDownloadJob,
  error: unknown
): Promise<void> => {
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected download worker error.";
  const shouldNotify = job.attempts >= job.maxAttempts;

  await db.transaction(async (tx) => {
    await tx
      .update(downloadJob)
      .set({
        errorMessage: message,
        leaseOwner: null,
        leasedAt: null,
        progressPercent: 0,
        status: "retryableFailed",
        updatedAt: new Date(),
      })
      .where(eq(downloadJob.id, job.id));

    if (shouldNotify) {
      await tx.insert(notification).values({
        body: `${buildChapterLabel(job)} failed after ${job.attempts} attempts. ${message}`,
        title: buildDownloadTitle(job),
        type: "downloadFailed",
        userId: job.userId,
      });
    }
  });
};
