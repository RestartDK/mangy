import { Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

export const ensureDirectory = (
  directoryPath: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* ensureDirectoryEffect() {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.makeDirectory(directoryPath, { recursive: true });
  });

export const removePath = (
  filePath: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* removePathEffect() {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.remove(filePath, { force: true, recursive: true });
  });

export const removeDirectory = removePath;

export const ensureEmptyDirectory = (
  directoryPath: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* ensureEmptyDirectoryEffect() {
    yield* removePath(directoryPath);
    yield* ensureDirectory(directoryPath);
  });

export const writeBytes = (
  filePath: string,
  data: Uint8Array
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* writeBytesEffect() {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.writeFile(filePath, data);
  });
