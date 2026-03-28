import { rm } from "node:fs/promises";

import {
  downloadPagesToFolder,
  prepareChapterOutputDirectory,
} from "@mangy/downloader";
import { sourceRegistry } from "@mangy/source-sdk/registry";

import {
  type ClaimedDownloadJob,
  cancelRunningDownloadJob,
  completeDownloadJob,
  isDownloadJobCancelled,
  updateDownloadJobProgress,
} from "./jobs";

export class CancelledError extends Error {
  constructor() {
    super("Download cancelled by user.");
    this.name = "CancelledError";
  }
}

const getRequiredValue = (value: string | null, message: string): string => {
  if (!value) {
    throw new Error(message);
  }

  return value;
};

export const runDownloadJob = async (
  job: ClaimedDownloadJob
): Promise<void> => {
  const sourceId = getRequiredValue(
    job.seriesSourceId,
    "This job is missing its source metadata."
  );
  const chapterExternalId = getRequiredValue(
    job.chapterExternalId,
    "This job is missing its chapter metadata."
  );
  const destinationPath = getRequiredValue(
    job.destinationPath,
    "This job does not have a valid destination path."
  );

  const adapter = sourceRegistry.get(sourceId);
  if (!adapter) {
    throw new Error(`No source adapter is registered for ${sourceId}.`);
  }

  const pageList = await adapter.getPages(chapterExternalId);
  if (pageList.pages.length === 0) {
    throw new Error("The source returned no pages for this chapter.");
  }

  const outputDirectory = await prepareChapterOutputDirectory({
    chapterId: chapterExternalId,
    chapterNumber: job.chapterNumber,
    chapterTitle: job.chapterTitle,
    destinationPath,
    seriesTitle: job.seriesTitle ?? "Series",
  });

  try {
    const downloadResult = await downloadPagesToFolder({
      beforePage: async () => {
        if (await isDownloadJobCancelled(job.id)) {
          throw new CancelledError();
        }
      },
      onProgress: ({ percent }) => updateDownloadJobProgress(job.id, percent),
      outputDirectory,
      pages: pageList.pages,
    });

    await completeDownloadJob(job, {
      fileSizeBytes: downloadResult.totalBytes,
      outputPath: outputDirectory,
    });
  } catch (error) {
    await rm(outputDirectory, { force: true, recursive: true });

    if (error instanceof CancelledError) {
      await cancelRunningDownloadJob(job.id);
    }

    throw error;
  }
};
