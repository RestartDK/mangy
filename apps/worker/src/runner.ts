import {
  downloadPagesToCbz,
  prepareChapterOutputFile,
  removePath,
} from "@mangy/downloader";
import { scanKomgaLibrary } from "@mangy/komga";
import type { SourceAdapterError } from "@mangy/source-sdk";
import { sourceRegistry } from "@mangy/source-sdk/registry";
import { Data, Effect, Option } from "effect";

import { DownloadJobError } from "./download-job-error";
import { completeDownloadJob, updateDownloadJobProgress } from "./jobs";
import type { ClaimedDownloadJob } from "./jobs";

export class CancelledError extends Data.TaggedError("CancelledError") {}

export type DownloadJobFailure =
  | CancelledError
  | DownloadJobError
  | SourceAdapterError;

const requireValue = (
  value: Option.Option<string>,
  message: string
): Effect.Effect<string, DownloadJobError> =>
  Option.isSome(value) && value.value.length > 0
    ? Effect.succeed(value.value)
    : Effect.fail(new DownloadJobError({ message }));

const promiseStep = <TResult>(
  evaluate: () => Promise<TResult>
): Effect.Effect<TResult, DownloadJobError> =>
  Effect.tryPromise({
    catch: (cause) =>
      new DownloadJobError({
        cause,
        message:
          cause instanceof Error ? cause.message : "Download step failed.",
      }),
    try: evaluate,
  });

export const runDownloadJob = (
  job: ClaimedDownloadJob,
  isCancelled: () => boolean
): Effect.Effect<void, DownloadJobFailure> =>
  Effect.gen(function* runDownloadJobEffect() {
    const sourceId = yield* requireValue(
      job.seriesSourceId,
      "This job is missing its source metadata."
    );
    const chapterExternalId = yield* requireValue(
      job.chapterExternalId,
      "This job is missing its chapter metadata."
    );
    const destinationPath = yield* requireValue(
      job.destinationPath,
      "This job does not have a valid destination path."
    );

    const adapter = sourceRegistry.get(sourceId);
    if (!adapter) {
      return yield* new DownloadJobError({
        message: `No source adapter is registered for ${sourceId}.`,
      });
    }

    const pageList = yield* adapter.getPages(chapterExternalId);
    if (pageList.pages.length === 0) {
      return yield* new DownloadJobError({
        message: "The source returned no pages for this chapter.",
      });
    }

    const pages = pageList.pages.map((page) => ({
      headers: page.headers,
      imageUrl: page.imageUrl,
      index: page.index,
      referer: page.referer,
    }));

    const outputPath = yield* promiseStep(
      async () =>
        await prepareChapterOutputFile({
          chapterId: chapterExternalId,
          chapterNumber: Option.getOrNull(job.chapterNumber),
          chapterTitle: Option.getOrNull(job.chapterTitle),
          destinationPath,
          extension: ".cbz",
          seriesTitle: Option.getOrElse(job.seriesTitle, () => "Series"),
        })
    );

    const downloadResult = yield* Effect.tryPromise({
      catch: (cause) =>
        cause instanceof CancelledError
          ? cause
          : new DownloadJobError({
              cause,
              message:
                cause instanceof Error
                  ? cause.message
                  : "The chapter download failed.",
            }),
      try: async () =>
        await downloadPagesToCbz({
          beforePage: () => {
            if (isCancelled()) {
              throw new CancelledError();
            }
          },
          onProgress: async ({ percent }) => {
            await updateDownloadJobProgress(job.id, percent);
          },
          outputPath,
          pages,
        }),
    }).pipe(
      Effect.tapError(() =>
        Effect.promise(async () => {
          await removePath(outputPath);
        }).pipe(Effect.ignoreCause)
      )
    );

    const importedToKomgaAt = yield* promiseStep(
      async () =>
        await scanKomgaLibrary({
          libraryId: Option.getOrNull(job.destinationKomgaLibraryId),
        })
    );

    return yield* promiseStep(async () => {
      await completeDownloadJob(job, {
        fileSizeBytes: downloadResult.totalBytes,
        importedToKomgaAt,
        outputPath,
        packageFormat: "cbz",
      });
    });
  });
