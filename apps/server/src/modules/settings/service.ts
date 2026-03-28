import { mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { db } from "@mangy/db";
import { downloadDestination } from "@mangy/db/schema";
import { asc, eq } from "drizzle-orm";

import { NotificationsService } from "../notifications/service";

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
};
