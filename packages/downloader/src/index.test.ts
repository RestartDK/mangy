import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { serve } from "bun";
import { unzipSync } from "fflate";

import {
  type DownloadProgress,
  downloadPagesToCbz,
  prepareChapterOutputFile,
} from "./index";

const cbzExtensionPattern = /\.cbz$/u;
const cleanupPaths = new Set<string>();

afterEach(async () => {
  for (const path of cleanupPaths) {
    await rm(path, { force: true, recursive: true });
  }
  cleanupPaths.clear();
});

describe("CBZ downloads", () => {
  test("prepares a sanitized .cbz output path without creating a chapter folder", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "mangy-cbz-path-"));
    cleanupPaths.add(tempDirectory);

    const outputPath = await prepareChapterOutputFile({
      chapterId: "chapter/id:one",
      chapterNumber: "7",
      chapterTitle: "A/B: C?",
      destinationPath: tempDirectory,
      extension: "cbz",
      seriesTitle: "Series: One",
    });

    expect(outputPath.endsWith(".cbz")).toBe(true);
    expect(basename(outputPath)).toBe("Chapter 7 - A B C [chapter id one].cbz");
    await expect(
      stat(outputPath.replace(cbzExtensionPattern, ""))
    ).rejects.toThrow();
  });

  test("writes downloaded pages into a valid CBZ archive", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "mangy-cbz-test-"));
    cleanupPaths.add(tempDirectory);

    const imageBytes = {
      png: new Uint8Array([1, 2, 3, 4]),
      webp: new Uint8Array([5, 6, 7]),
    };
    const imageRequests: string[] = [];
    const progressEvents: DownloadProgress[] = [];
    const server = serve({
      fetch(request) {
        const url = new URL(request.url);
        imageRequests.push(url.pathname);

        if (url.pathname === "/second.webp") {
          return new Response(imageBytes.webp, {
            headers: { "content-type": "image/webp" },
          });
        }

        return new Response(imageBytes.png, {
          headers: { "content-type": "image/png" },
        });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    try {
      const outputPath = await prepareChapterOutputFile({
        chapterId: "chapter-one",
        chapterNumber: "1",
        chapterTitle: null,
        destinationPath: tempDirectory,
        extension: ".cbz",
        seriesTitle: "CBZ Test Series",
      });

      const result = await downloadPagesToCbz({
        onProgress: (progress) => {
          progressEvents.push(progress);
        },
        outputPath,
        pages: [
          {
            imageUrl: `http://127.0.0.1:${server.port}/second.webp`,
            index: 1,
          },
          {
            imageUrl: `http://127.0.0.1:${server.port}/first.png`,
            index: 0,
          },
        ],
      });

      const archiveBytes = new Uint8Array(await readFile(outputPath));
      const files = unzipSync(archiveBytes);

      expect(Object.keys(files).sort()).toEqual(["001.png", "002.webp"]);
      expect(files["001.png"]).toEqual(imageBytes.png);
      expect(files["002.webp"]).toEqual(imageBytes.webp);
      expect(result).toEqual({
        fileCount: 2,
        totalBytes: archiveBytes.byteLength,
      });
      expect(progressEvents.map((event) => event.percent)).toEqual([50, 100]);
      expect(imageRequests).toEqual(["/first.png", "/second.webp"]);
    } finally {
      server.stop(true);
    }
  });
});
