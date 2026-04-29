import {
  downloadPagesToFolder,
  prepareChapterOutputDirectory,
  removeDirectory,
} from "@mangy/downloader";
import { sourceRegistry } from "@mangy/source-sdk/registry";

import {
  type ClaimedDownloadJob,
  cancelRunningDownloadJob,
  completeDownloadJob,
  isDownloadJobCancelled,
  updateDownloadJobProgress,
} from "./jobs";
import { scanKomgaLibrary } from "./komga";

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

  const pages = pageList.pages.map((page) => ({
    headers: page.headers,
    imageUrl: page.imageUrl,
    index: page.index,
    referer: page.referer,
  }));

  const outputDirectory = await prepareChapterOutputDirectory({
    chapterId: chapterExternalId,
    chapterNumber: job.chapterNumber,
    chapterTitle: job.chapterTitle,
    destinationPath,
    seriesTitle: job.seriesTitle ?? "Series",
  });
  let didFinishDownload = false;

  try {
    const downloadResult = await downloadPagesToFolder({
      beforePage: async () => {
        if (await isDownloadJobCancelled(job.id)) {
          throw new CancelledError();
        }
      },
      onProgress: ({ percent }) => updateDownloadJobProgress(job.id, percent),
      outputDirectory,
      pages,
    });
    didFinishDownload = true;
    const importedToKomgaAt = await scanKomgaLibrary({
      libraryId: job.destinationKomgaLibraryId,
    });

    await completeDownloadJob(job, {
      fileSizeBytes: downloadResult.totalBytes,
      importedToKomgaAt,
      outputPath: outputDirectory,
    });
  } catch (error) {
    if (!didFinishDownload) {
      await removeDirectory(outputDirectory);
    }

    if (error instanceof CancelledError) {
      await cancelRunningDownloadJob(job.id);
    }

    throw error;
  }
};
