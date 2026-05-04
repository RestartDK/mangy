declare const Bun: typeof import("bun");

import { mkdir, rm } from "node:fs/promises";

export const ensureDirectory = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

export const removePath = async (path: string): Promise<void> => {
  await rm(path, { force: true, recursive: true });
};

export const ensureEmptyDirectory = async (path: string): Promise<void> => {
  await removePath(path);
  await ensureDirectory(path);
};

export const removeDirectory = async (path: string): Promise<void> => {
  await removePath(path);
};

export const writeBytes = async (
  path: string,
  data: Uint8Array
): Promise<void> => {
  await Bun.write(path, data);
};
