import { z } from "zod";

export const destinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  absolutePath: z.string(),
  komgaLibraryId: z.string().nullable(),
  isDefault: z.boolean(),
  isEnabled: z.boolean(),
});

export const settingsBootstrapSchema = z.object({
  profile: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  destinations: z.array(destinationSchema),
});

export const unauthorizedResponseSchema = z.object({
  message: z.string(),
});
