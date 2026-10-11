import { BunServices } from "@effect/platform-bun";
import { Effect, FileSystem, Path } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { Zip, ZipPassThrough } from "fflate";

import * as fs from "./fs";

type PlatformServices = FileSystem.FileSystem | Path.Path;

const runPlatform = async <A, E>(
  program: Effect.Effect<A, E, PlatformServices>
): Promise<A> =>
  await Effect.runPromise(Effect.provide(program, BunServices.layer));

const attempt = <A>(
  evaluate: () => A | PromiseLike<A>
): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof Error ? cause : new Error(String(cause)),
    try: async () => await evaluate(),
  });

export const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await runPlatform(fs.ensureDirectory(directoryPath));
};

export const ensureEmptyDirectory = async (
  directoryPath: string
): Promise<void> => {
  await runPlatform(fs.ensureEmptyDirectory(directoryPath));
};

export const removeDirectory = async (directoryPath: string): Promise<void> => {
  await runPlatform(fs.removeDirectory(directoryPath));
};

export const removePath = async (filePath: string): Promise<void> => {
  await runPlatform(fs.removePath(filePath));
};

export const writeBytes = async (
  filePath: string,
  data: Uint8Array
): Promise<void> => {
  await runPlatform(fs.writeBytes(filePath, data));
};

const queryAndHashPattern = /[?#].*$/u;

export interface DownloadPage {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>;
  referer?: string;
}

const createRequestHeaders = (page: DownloadPage): Headers => {
  const headers = new Headers(page.headers);

  if (
    page.referer !== undefined &&
    page.referer.length > 0 &&
    !headers.has("referer")
  ) {
    headers.set("referer", page.referer);
  }

  return headers;
};

export interface DownloadPagesResult {
  fileCount: number;
  totalBytes: number;
}

export interface DownloadProgress {
  completed: number;
  percent: number;
  total: number;
}

interface PrepareChapterOutputInput {
  chapterId: string;
  chapterNumber: string | null;
  chapterTitle: string | null;
  destinationPath: string;
  seriesTitle: string;
}

interface PrepareChapterOutputFileInput extends PrepareChapterOutputInput {
  extension: string;
}

interface ChapterOutputPaths {
  chapterLabel: string;
  seriesDirectory: string;
}

interface DownloadPagesInput {
  beforePage?: (page: DownloadPage) => Promise<void> | void;
  onProgress?: (progress: DownloadProgress) => Promise<void> | void;
  pages: DownloadPage[];
}

interface DownloadPagesToFolderInput extends DownloadPagesInput {
  outputDirectory: string;
}

interface DownloadPagesToCbzInput extends DownloadPagesInput {
  outputPath: string;
}

const invalidPathCharacters = new Set([
  "<",
  ">",
  ":",
  '"',
  "/",
  "\\",
  "|",
  "?",
  "*",
]);

const sanitizePathSegment = (value: string, fallback: string): string => {
  const normalized = Array.from(value, (character) => {
    if (
      invalidPathCharacters.has(character) ||
      (character.codePointAt(0) ?? 0) < 32
    ) {
      return " ";
    }

    return character;
  }).join("");

  const sanitized = normalized
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/\.+$/gu, "")
    .trim();

  if (!sanitized) {
    return fallback;
  }

  return sanitized.slice(0, 120);
};

const getFileExtension = (
  path: Path.Path,
  imageUrl: string,
  contentType: string | null | undefined
): string => {
  if (
    contentType !== null &&
    contentType !== undefined &&
    contentType.length > 0
  ) {
    if (contentType.includes("png")) {
      return ".png";
    }

    if (contentType.includes("webp")) {
      return ".webp";
    }

    if (contentType.includes("gif")) {
      return ".gif";
    }
  }

  try {
    const extension = path.extname(new URL(imageUrl).pathname);

    if (extension) {
      return extension;
    }
  } catch {
    const extension = path.extname(imageUrl.replace(queryAndHashPattern, ""));

    if (extension) {
      return extension;
    }
  }

  return ".jpg";
};

export const formatChapterLabel = (
  chapterNumber: string | null,
  chapterTitle: string | null,
  chapterId: string
): string => {
  const numberLabel =
    chapterNumber !== null && chapterNumber.length > 0
      ? `Chapter ${chapterNumber}`
      : "Special";
  const titleLabel =
    chapterTitle !== null && chapterTitle.length > 0
      ? ` - ${sanitizePathSegment(chapterTitle, "Chapter")}`
      : "";
  const suffix = ` [${chapterId}]`;

  return sanitizePathSegment(
    `${numberLabel}${titleLabel}${suffix}`,
    `Chapter [${chapterId}]`
  );
};

const getChapterOutputPaths = (
  path: Path.Path,
  {
    chapterId,
    chapterNumber,
    chapterTitle,
    destinationPath,
    seriesTitle,
  }: PrepareChapterOutputInput
): ChapterOutputPaths => {
  const safeSeriesTitle = sanitizePathSegment(seriesTitle, "Series");
  const chapterLabel = formatChapterLabel(
    chapterNumber,
    chapterTitle,
    chapterId
  );

  return {
    chapterLabel,
    seriesDirectory: path.join(destinationPath, safeSeriesTitle),
  };
};

const normalizeExtension = (extension: string): string =>
  extension.startsWith(".") ? extension : `.${extension}`;

const orderPages = (pages: DownloadPage[]): DownloadPage[] =>
  [...pages].toSorted((left, right) => left.index - right.index);

const downloadPage = (path: Path.Path, page: DownloadPage) =>
  attempt(async () => {
    const response = await fetch(page.imageUrl, {
      headers: createRequestHeaders(page),
    });
    if (!response.ok) {
      throw new Error(`Page download failed with status ${response.status}`);
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      extension: getFileExtension(
        path,
        page.imageUrl,
        response.headers.get("content-type")
      ),
    };
  });

const reportProgress = (
  onProgress:
    | ((progress: DownloadProgress) => Promise<void> | void)
    | undefined,
  completed: number,
  total: number
): Effect.Effect<void, Error> =>
  attempt(async () => {
    await onProgress?.({
      completed,
      percent: Math.round((completed / total) * 100),
      total,
    });
  });

const prepareChapterOutputDirectoryProgram = (
  input: PrepareChapterOutputInput
): Effect.Effect<string, Error, PlatformServices> =>
  Effect.gen(function* prepareChapterOutputDirectoryEffect() {
    const path = yield* Path.Path;
    const { chapterLabel, seriesDirectory } = getChapterOutputPaths(
      path,
      input
    );
    const outputDirectory = path.join(seriesDirectory, chapterLabel);

    yield* fs.ensureEmptyDirectory(outputDirectory);

    return outputDirectory;
  });

export const prepareChapterOutputDirectory = async (
  input: PrepareChapterOutputInput
): Promise<string> =>
  await runPlatform(prepareChapterOutputDirectoryProgram(input));

const prepareChapterOutputFileProgram = ({
  extension,
  ...input
}: PrepareChapterOutputFileInput): Effect.Effect<
  string,
  Error,
  PlatformServices
> =>
  Effect.gen(function* prepareChapterOutputFileEffect() {
    const path = yield* Path.Path;
    const { chapterLabel, seriesDirectory } = getChapterOutputPaths(
      path,
      input
    );
    const outputPath = `${path.join(seriesDirectory, chapterLabel)}${normalizeExtension(extension)}`;

    yield* fs.ensureDirectory(seriesDirectory);
    yield* fs.removePath(outputPath);

    return outputPath;
  });

export const prepareChapterOutputFile = async (
  input: PrepareChapterOutputFileInput
): Promise<string> => await runPlatform(prepareChapterOutputFileProgram(input));

const downloadPagesToFolderProgram = ({
  beforePage,
  onProgress,
  outputDirectory,
  pages,
}: DownloadPagesToFolderInput): Effect.Effect<
  DownloadPagesResult,
  Error,
  PlatformServices
> =>
  Effect.gen(function* downloadPagesToFolderEffect() {
    const path = yield* Path.Path;
    const orderedPages = orderPages(pages);
    let totalBytes = 0;

    for (const [index, page] of orderedPages.entries()) {
      yield* attempt(async () => {
        await beforePage?.(page);
      });

      const { bytes, extension } = yield* downloadPage(path, page);
      totalBytes += bytes.byteLength;

      const fileName = `${String(index + 1).padStart(3, "0")}${extension}`;

      yield* fs.writeBytes(path.join(outputDirectory, fileName), bytes);
      yield* reportProgress(onProgress, index + 1, orderedPages.length);
    }

    return { fileCount: orderedPages.length, totalBytes };
  });

export const downloadPagesToFolder = async (
  input: DownloadPagesToFolderInput
): Promise<DownloadPagesResult> =>
  await runPlatform(downloadPagesToFolderProgram(input));

const downloadPagesToCbzProgram = ({
  beforePage,
  onProgress,
  outputPath,
  pages,
}: DownloadPagesToCbzInput): Effect.Effect<
  DownloadPagesResult,
  Error,
  PlatformServices
> =>
  Effect.gen(function* downloadPagesToCbzEffect() {
    const path = yield* Path.Path;
    const fileSystem = yield* FileSystem.FileSystem;
    const orderedPages = orderPages(pages);
    const pendingChunks: Uint8Array[] = [];
    let totalBytes = 0;

    const archive = new Zip((error, chunk) => {
      if (error) {
        throw error;
      }

      totalBytes += chunk.byteLength;
      pendingChunks.push(chunk);
    });

    const flushChunks = (
      file: FileSystem.File
    ): Effect.Effect<void, PlatformError> =>
      Effect.gen(function* flushChunksEffect() {
        if (pendingChunks.length === 0) {
          return;
        }

        const chunks = pendingChunks.splice(0);

        for (const chunk of chunks) {
          yield* file.write(chunk);
        }
      });

    const writeArchive = Effect.gen(function* writeArchiveEffect() {
      const file = yield* fileSystem.open(outputPath, { flag: "w" });

      for (const [index, page] of orderedPages.entries()) {
        yield* attempt(async () => {
          await beforePage?.(page);
        });

        const { bytes, extension } = yield* downloadPage(path, page);
        const pageEntry = new ZipPassThrough(
          `${String(index + 1).padStart(3, "0")}${extension}`
        );

        archive.add(pageEntry);
        pageEntry.push(bytes, true);
        yield* flushChunks(file);
        yield* reportProgress(onProgress, index + 1, orderedPages.length);
      }

      archive.end();
      yield* flushChunks(file);

      return { fileCount: orderedPages.length, totalBytes };
    });

    return yield* Effect.scoped(writeArchive).pipe(
      Effect.onError(() => Effect.ignore(fileSystem.remove(outputPath)))
    );
  });

export const downloadPagesToCbz = async (
  input: DownloadPagesToCbzInput
): Promise<DownloadPagesResult> =>
  await runPlatform(downloadPagesToCbzProgram(input));
