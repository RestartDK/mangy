import { env } from "@mangy/env";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export const db: NodePgDatabase<typeof schema> = drizzle(env.DATABASE_URL, {
  schema,
});
