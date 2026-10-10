import { PgClient } from "@effect/sql-pg";
import { env } from "@mangy/env";
import { ManagedRuntime, Redacted, Schema } from "effect";
import type { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { fragment, identifier } from "effect/sql/Statement";
import type { Fragment } from "effect/sql/Statement";

import { modelTables } from "./model";

export type ModelName = keyof typeof modelTables;

type ColumnMap = Record<string, string>;

type RowValues<C extends ColumnMap> = Partial<Record<keyof C, unknown>>;

const runtime = ManagedRuntime.make(
  PgClient.layer({
    // `timestamp` columns carry instants and the driver reads their wall clock
    // as UTC, so pin the session to UTC and writes and reads stay a fixed point
    // instead of shifting by the server's zone on every round trip.
    startupOptions: "-c TimeZone=UTC",
    url: Redacted.make(env.DATABASE_URL),
  })
);

export const runSql = <A, E>(
  program: Effect.Effect<A, E, SqlClient.SqlClient>
): Promise<A> => runtime.runPromise(program);

export const decodeRows = <A, I>(
  schema: Schema.Codec<A, I>,
  rows: readonly unknown[]
): Effect.Effect<readonly A[], Schema.SchemaError> =>
  Schema.decodeUnknownEffect(Schema.Array(schema))(rows);

const columnName = (columns: ColumnMap, field: string): string =>
  columns[field] as string;

export const table = (model: ModelName): Fragment =>
  fragment([identifier(modelTables[model].table)]);

export const column = <C extends ColumnMap>(
  columns: C,
  field: keyof C
): Fragment => fragment([identifier(columnName(columns, field as string))]);

const asColumns = <C extends ColumnMap>(
  columns: C,
  values: RowValues<C>
): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    record[columnName(columns, field)] = value;
  }
  return record;
};

export const insertRow = <C extends ColumnMap>(
  sql: SqlClient.SqlClient,
  columns: C,
  values: RowValues<C> | readonly RowValues<C>[]
): Fragment => {
  const rows = Array.isArray(values) ? values : [values];
  return fragment([sql.insert(rows.map((row) => asColumns(columns, row)))]);
};

export const updateRow = <C extends ColumnMap>(
  sql: SqlClient.SqlClient,
  columns: C,
  values: RowValues<C>
): Fragment => fragment([sql.update(asColumns(columns, values))]);
