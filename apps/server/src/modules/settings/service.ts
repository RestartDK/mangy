import { db } from "@mangy/db";
import { downloadDestination } from "@mangy/db/schema";
import { asc, eq } from "drizzle-orm";

interface UserProfile {
  email: string;
  name: string;
}

export abstract class SettingsService {
  static async getBootstrap(userId: string, profile: UserProfile) {
    const destinations = await db
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
      .orderBy(asc(downloadDestination.name));

    return {
      profile,
      destinations: destinations.map((destination) => ({
        ...destination,
        komgaLibraryId: destination.komgaLibraryId ?? null,
      })),
    };
  }
}
