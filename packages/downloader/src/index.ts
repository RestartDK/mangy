import { zipSync } from "fflate";

import {
  ensureDirectory,
  ensureEmptyDirectory,
  removePath,
  writeBytes,
} from "./fs";

export {
  ensureDirectory,
  ensureEmptyDirectory,
  removeDirectory,
  removePath,
  writeBytes,
} from "./fs";

const trailingSeparatorsPattern = /[\\/]+$/u;
const leadingAndTrailingSeparatorsPattern = /^[\\/]+|[\\/]+$/gu;
const queryAndHashPattern = /[?#].*$/u;
const pathSeparatorsPattern = /[\\/]/u;

const getPathSeparator = (path: string): string =>
  path.includes("\\") && !path.includes("/") ? "\\" : "/";

const trimTrailingSeparators = (value: string): string =>
  value.replace(trailingSeparatorsPattern, "");

const joinPath = (...parts: string[]): string => {
  const [firstPart, ...restParts] = parts.filter(Boolean);

  if (!firstPart) {
    return "";
  }

  const separator = getPathSeparator(firstPart);
  let joined = trimTrailingSeparators(firstPart);

  for (const part of restParts) {
    const trimmedPart = part.replace(leadingAndTrailingSeparatorsPattern, "");

    if (!trimmedPart) {
      continue;
    }

    joined = `${joined}${separator}${trimmedPart}`;
  }

  return joined;
};

const getExtension = (value: string): string => {
  const normalizedValue = value.replace(queryAndHashPattern, "");
  const fileName = normalizedValue.split(pathSeparatorsPattern).pop() ?? "";
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return "";
  }

  return fileName.slice(extensionIndex);
};

export interface DownloadPage {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>;
  referer?: string;
}

const createRequestHeaders = (page: DownloadPage): Headers => {
  const headers = new Headers(page.headers);

  if (page.referer && !headers.has("referer")) {
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
    if (invalidPathCharacters.has(character) || character.charCodeAt(0) < 32) {
      return " ";
    }

    return character;
  }).join("");

  const sanitized = normalized.replace(/\s+/g, " ").replace(/\.+$/g, "").trim();

  if (!sanitized) {
    return fallback;
  }

  return sanitized.slice(0, 120);
};

const getFileExtension = (
  imageUrl: string,
  contentType: string | null | undefined
): string => {
  if (contentType) {
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
    const url = new URL(imageUrl);
    const extension = getExtension(url.pathname);
    if (extension) {
      return extension;
    }
  } catch {
    const extension = getExtension(imageUrl);
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
  const numberLabel = chapterNumber ? `Chapter ${chapterNumber}` : "Special";
  const titleLabel = chapterTitle
    ? ` - ${sanitizePathSegment(chapterTitle, "Chapter")}`
    : "";
  const suffix = ` [${chapterId}]`;

  return sanitizePathSegment(
    `${numberLabel}${titleLabel}${suffix}`,
    `Chapter [${chapterId}]`
  );
};

const getChapterOutputPaths = ({
  chapterId,
  chapterNumber,
  chapterTitle,
  destinationPath,
  seriesTitle,
}: PrepareChapterOutputInput): ChapterOutputPaths => {
  const safeSeriesTitle = sanitizePathSegment(seriesTitle, "Series");
  const chapterLabel = formatChapterLabel(
    chapterNumber,
    chapterTitle,
    chapterId
  );

  return {
    chapterLabel,
    seriesDirectory: joinPath(destinationPath, safeSeriesTitle),
  };
};

const normalizeExtension = (extension: string): string =>
  extension.startsWith(".") ? extension : `.${extension}`;

export const prepareChapterOutputDirectory = async (
  input: PrepareChapterOutputInput
): Promise<string> => {
  const { chapterLabel, seriesDirectory } = getChapterOutputPaths(input);
  const outputDirectory = joinPath(seriesDirectory, chapterLabel);

  await ensureEmptyDirectory(outputDirectory);

  return outputDirectory;
};

export const prepareChapterOutputFile = async ({
  extension,
  ...input
}: PrepareChapterOutputFileInput): Promise<string> => {
  const { chapterLabel, seriesDirectory } = getChapterOutputPaths(input);
  const outputPath = `${joinPath(seriesDirectory, chapterLabel)}${normalizeExtension(extension)}`;

  await ensureDirectory(seriesDirectory);
  await removePath(outputPath);

  return outputPath;
};

export const downloadPagesToFolder = async ({
  beforePage,
  onProgress,
  outputDirectory,
  pages,
}: {
  beforePage?: (page: DownloadPage) => Promise<void> | void;
  onProgress?: (progress: DownloadProgress) => Promise<void> | void;
  outputDirectory: string;
  pages: DownloadPage[];
}): Promise<DownloadPagesResult> => {
  const orderedPages = [...pages].sort(
    (left, right) => left.index - right.index
  );
  let totalBytes = 0;

  for (const [index, page] of orderedPages.entries()) {
    if (beforePage) {
      await beforePage(page);
    }

    const response = await fetch(page.imageUrl, {
      headers: createRequestHeaders(page),
    });
    if (!response.ok) {
      throw new Error(`Page download failed with status ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    totalBytes += bytes.byteLength;

    const extension = getFileExtension(
      page.imageUrl,
      response.headers.get("content-type")
    );
    const fileName = `${String(index + 1).padStart(3, "0")}${extension}`;

    await writeBytes(joinPath(outputDirectory, fileName), bytes);

    if (onProgress) {
      const completed = index + 1;
      await onProgress({
        completed,
        percent: Math.round((completed / orderedPages.length) * 100),
        total: orderedPages.length,
      });
    }
  }

  return {
    fileCount: orderedPages.length,
    totalBytes,
  };
};

export const downloadPagesToCbz = async ({
  beforePage,
  onProgress,
  outputPath,
  pages,
}: {
  beforePage?: (page: DownloadPage) => Promise<void> | void;
  onProgress?: (progress: DownloadProgress) => Promise<void> | void;
  outputPath: string;
  pages: DownloadPage[];
}): Promise<DownloadPagesResult> => {
  const orderedPages = [...pages].sort(
    (left, right) => left.index - right.index
  );
  const files: Record<string, Uint8Array> = {};

  for (const [index, page] of orderedPages.entries()) {
    if (beforePage) {
      await beforePage(page);
    }

    const response = await fetch(page.imageUrl, {
      headers: createRequestHeaders(page),
    });
    if (!response.ok) {
      throw new Error(`Page download failed with status ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = getFileExtension(
      page.imageUrl,
      response.headers.get("content-type")
    );
    const fileName = `${String(index + 1).padStart(3, "0")}${extension}`;
    files[fileName] = bytes;

    if (onProgress) {
      const completed = index + 1;
      await onProgress({
        completed,
        percent: Math.round((completed / orderedPages.length) * 100),
        total: orderedPages.length,
      });
    }
  }

  const cbzBytes = zipSync(files, { level: 0 });
  await writeBytes(outputPath, cbzBytes);

  return {
    fileCount: orderedPages.length,
    totalBytes: cbzBytes.byteLength,
  };
};
