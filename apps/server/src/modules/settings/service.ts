import { mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { db } from "@mangy/db";
import {
  downloadDestination,
  downloadJob,
  libraryEntry,
} from "@mangy/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

import { NotificationsService } from "../notifications/service";

const activeDownloadJobStatuses = [
  "queued",
  "running",
  "retryableFailed",
] as const;

interface UserProfile {
  email: string;
  name: string;
}

export const SettingsService = {
  async getBootstrap(userId: string, profile: UserProfile) {
    const [destinations, notifications] = await Promise.all([
      db
        .select({
          id: downloadDestination.id,
          name: downloadDestination.name,
          absolutePath: downloadDestination.absolutePath,
          komgaLibraryId: downloadDestination.komgaLibraryId,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
        })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId))
        .orderBy(asc(downloadDestination.name)),
      NotificationsService.getPreferences(userId),
    ]);

    return {
      destinations: destinations.map((destination) => ({
        ...destination,
        komgaLibraryId: destination.komgaLibraryId ?? null,
      })),
      notifications,
      profile,
    };
  },

  async createDestination(
    userId: string,
    input: {
      name: string;
      absolutePath: string;
      komgaLibraryId?: string;
      isDefault?: boolean;
    }
  ) {
    const absolutePath = input.absolutePath.trim();
    if (!isAbsolute(absolutePath)) {
      throw new Error("Destination paths must be absolute.");
    }

    await mkdir(absolutePath, { recursive: true });

    return db.transaction(async (tx) => {
      const existingDestinations = await tx
        .select({ id: downloadDestination.id })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId));

      const shouldBeDefault =
        input.isDefault === true || existingDestinations.length === 0;

      if (shouldBeDefault) {
        await tx
          .update(downloadDestination)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(downloadDestination.userId, userId));
      }

      const [destination] = await tx
        .insert(downloadDestination)
        .values({
          absolutePath,
          isDefault: shouldBeDefault,
          komgaLibraryId: input.komgaLibraryId?.trim() || null,
          name: input.name.trim(),
          userId,
        })
        .returning({
          absolutePath: downloadDestination.absolutePath,
          id: downloadDestination.id,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
          komgaLibraryId: downloadDestination.komgaLibraryId,
          name: downloadDestination.name,
        });

      if (!destination) {
        throw new Error("Unable to save this destination.");
      }

      return {
        ...destination,
        komgaLibraryId: destination.komgaLibraryId ?? null,
      };
    });
  },

  async deleteDestination(userId: string, destinationId: string) {
    return await db.transaction(async (tx) => {
      const destinations = await tx
        .select({
          id: downloadDestination.id,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
        })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId))
        .orderBy(asc(downloadDestination.name));

      const destination = destinations.find(
        (item) => item.id === destinationId
      );
      if (!destination) {
        throw new Error("Destination not found.");
      }

      const [activeJob] = await tx
        .select({ id: downloadJob.id })
        .from(downloadJob)
        .where(
          and(
            eq(downloadJob.userId, userId),
            eq(downloadJob.downloadDestinationId, destinationId),
            inArray(downloadJob.status, activeDownloadJobStatuses)
          )
        )
        .limit(1);

      if (activeJob) {
        throw new Error(
          "This destination is still used by queued or running downloads. Cancel or finish those jobs first."
        );
      }

      const fallbackDestination = destination.isDefault
        ? (destinations.find(
            (item) => item.id !== destinationId && item.isEnabled
          ) ?? destinations.find((item) => item.id !== destinationId))
        : null;
      const now = new Date();

      await tx
        .update(libraryEntry)
        .set({
          autoDownload: false,
          downloadDestinationId: null,
          updatedAt: now,
        })
        .where(eq(libraryEntry.downloadDestinationId, destinationId));

      await tx
        .delete(downloadDestination)
        .where(
          and(
            eq(downloadDestination.id, destinationId),
            eq(downloadDestination.userId, userId)
          )
        );

      if (destination.isDefault && fallbackDestination) {
        await tx
          .update(downloadDestination)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(downloadDestination.userId, userId));

        await tx
          .update(downloadDestination)
          .set({ isDefault: true, updatedAt: now })
          .where(eq(downloadDestination.id, fallbackDestination.id));
      }

      return { id: destinationId };
    });
  },
};
