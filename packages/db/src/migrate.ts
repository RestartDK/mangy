import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { BunRuntime } from "@effect/platform-bun";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import { Migrator, SqlClient, Statement } from "effect/sql";

const migrationsDirectory = path.join(import.meta.dir, "migrations");
const statementBreakpoint = "--> statement-breakpoint";

const loadMigrations = Effect.gen(function* loadMigrations() {
  const entries = yield* Effect.tryPromise({
    catch: (cause) => new Error(`Cannot read ${migrationsDirectory}`, { cause }),
    try: () => readdir(migrationsDirectory),
  });

  const record: Record<
    string,
    Effect.Effect<void, unknown, SqlClient.SqlClient>
  > = {};

  const files = entries.filter((entry) => entry.endsWith(".sql")).toSorted();

  for (const [index, file] of files.entries()) {
    const name = file.replace(/\.sql$/u, "");

    // Ids start at 1 because the migrator reads an empty table as latest id 0
    // and skips every migration whose id is <= it. A file numbered 0000 would
    // parse to id 0 and never run on a fresh database.
    record[`${index + 1}_${name}`] = Effect.gen(function* loadMigration() {
      const sql = yield* SqlClient.SqlClient;
      const contents = yield* Effect.tryPromise({
        catch: (cause) => new Error(`Cannot read ${file}`, { cause }),
        try: () => readFile(path.join(migrationsDirectory, file), "utf-8"),
      });

      for (const statement of contents.split(statementBreakpoint)) {
        const trimmed = statement.trim();

        if (trimmed.length > 0) {
          yield* sql`${Statement.literal(trimmed)}`;
        }
      }
    });
  }

  return record;
});

const program = Effect.gen(function* program() {
  const record = yield* loadMigrations;
  const migrate = Migrator.make({});
  const applied = yield* migrate({ loader: Migrator.fromRecord(record) });

  yield* Effect.logInfo(
    applied.length === 0
      ? "No pending migrations."
      : `Applied ${applied.length} migration(s).`
  );
});

program.pipe(
  Effect.provide(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
  BunRuntime.runMain
);
