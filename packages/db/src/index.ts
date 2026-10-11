import { PgClient, PgTypes } from "@effect/sql-pg";
import { Config, ManagedRuntime, Result, Schema } from "effect";
import type { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { fragment, identifier } from "effect/sql/Statement";
import type { Fragment } from "effect/sql/Statement";

import { modelTables } from "./model";
import { databaseConfig } from "./config";

export type ModelName = keyof typeof modelTables;

type ColumnMap = Record<string, string>;

type RowValues<C extends ColumnMap> = Partial<Record<keyof C, unknown>>;

const runtime = ManagedRuntime.make(
  PgClient.layerConfig({
    // `timestamp` columns carry instants and the driver reads their wall clock
    // as UTC, so pin the session to UTC and writes and reads stay a fixed point
    // instead of shifting by the server's zone on every round trip.
    startupOptions: Config.succeed("-c TimeZone=UTC"),
    ...databaseConfig(),
  })
);

export const runSql = async <A, E>(
  program: Effect.Effect<A, E, SqlClient.SqlClient>
): Promise<A> => await runtime.runPromise(program);

export const decodeRows = <A, I>(
  schema: Schema.Codec<A, I>,
  rows: readonly unknown[]
): Effect.Effect<readonly A[], Schema.SchemaError> =>
  Schema.decodeUnknownEffect(Schema.Array(schema))(rows);

const isReadonlyArray = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value);

const columnName = (columns: ColumnMap, field: string): string => {
  const column = columns[field];

  if (column === undefined) {
    throw new Error(`Unknown column: ${field}`);
  }

  return column;
};

export const table = (model: ModelName): Fragment =>
  fragment([identifier(modelTables[model].table)]);

export const column = <C extends ColumnMap>(
  columns: C,
  field: Extract<keyof C, string>
): Fragment => fragment([identifier(columnName(columns, field))]);

// An empty array tells the driver nothing about its element type, so it needs
// an explicit OID. Every array column in this schema is `text[]`.
const encodeValue = (value: unknown): unknown =>
  Array.isArray(value) && value.length === 0
    ? Result.getOrThrow(PgTypes.array([], PgTypes.OID.text))
    : value;

const asColumns = <C extends ColumnMap>(
  columns: C,
  values: RowValues<C>
): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    record[columnName(columns, field)] = encodeValue(value);
  }
  return record;
};

export const insertRow = <C extends ColumnMap>(
  sql: SqlClient.SqlClient,
  columns: C,
  values: RowValues<C> | readonly RowValues<C>[]
): Fragment => {
  const rows: readonly RowValues<C>[] = isReadonlyArray(values)
    ? values
    : [values];
  return fragment([sql.insert(rows.map((row) => asColumns(columns, row)))]);
};

export const updateRow = <C extends ColumnMap>(
  sql: SqlClient.SqlClient,
  columns: C,
  values: RowValues<C>
): Fragment => fragment([sql.update(asColumns(columns, values))]);
