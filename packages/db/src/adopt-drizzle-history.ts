import { BunRuntime } from "@effect/platform-bun";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import { SqlClient } from "effect/sql";

const adoptedMigrations = [
  [1, "0000_real_marauders"],
  [2, "0001_brief_mach_iv"],
  [3, "0002_real_ezekiel"],
  [4, "0003_phase3_manga_foundation"],
  [5, "0004_browser_push_notifications"],
] as const;

const program = Effect.gen(function* program() {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS effect_sql_migrations (
      migration_id integer NOT NULL PRIMARY KEY,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      name text NOT NULL
    )
  `;

  for (const [migrationId, name] of adoptedMigrations) {
    yield* sql`
      INSERT INTO effect_sql_migrations (migration_id, name)
      VALUES (${migrationId}, ${name})
      ON CONFLICT (migration_id) DO NOTHING
    `;
  }

  yield* Effect.logInfo(
    `Recorded ${adoptedMigrations.length} migration(s) already applied by drizzle-kit.`
  );
});

program.pipe(
  Effect.provide(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
  BunRuntime.runMain
);
