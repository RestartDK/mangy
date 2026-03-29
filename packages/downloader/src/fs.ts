declare const Bun: typeof import("bun");

import { mkdir, rm } from "node:fs/promises";

export const ensureEmptyDirectory = async (path: string): Promise<void> => {
  await rm(path, { force: true, recursive: true });
  await mkdir(path, { recursive: true });
};

export const removeDirectory = async (path: string): Promise<void> => {
  await rm(path, { force: true, recursive: true });
};

export const writeBytes = async (
  path: string,
  data: Uint8Array
): Promise<void> => {
  await Bun.write(path, data);
};
