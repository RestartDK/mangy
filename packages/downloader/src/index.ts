import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export interface DownloadPage {
  index: number;
  imageUrl: string;
}

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
    const extension = extname(url.pathname);
    if (extension) {
      return extension;
    }
  } catch {
    const extension = extname(imageUrl);
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

export const prepareChapterOutputDirectory = async ({
  chapterId,
  chapterNumber,
  chapterTitle,
  destinationPath,
  seriesTitle,
}: PrepareChapterOutputInput): Promise<string> => {
  const safeSeriesTitle = sanitizePathSegment(seriesTitle, "Series");
  const chapterLabel = formatChapterLabel(
    chapterNumber,
    chapterTitle,
    chapterId
  );
  const outputDirectory = join(destinationPath, safeSeriesTitle, chapterLabel);

  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  return outputDirectory;
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

    const response = await fetch(page.imageUrl);
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

    await writeFile(join(outputDirectory, fileName), bytes);

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
