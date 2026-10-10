import { PgClient } from "@effect/sql-pg";
import { columnsByModel } from "@mangy/db/model";
import { env } from "@mangy/env";
import { createAdapterFactory } from "better-auth/adapters";
import type {
  AdapterFactoryCustomizeAdapterCreator,
  CleanedWhere,
  CustomAdapter,
  JoinConfig,
  ModelTarget,
} from "better-auth/adapters";
import { Effect, ManagedRuntime, Redacted } from "effect";
import { SqlClient, Statement } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";

type AdapterHelpers = Parameters<AdapterFactoryCustomizeAdapterCreator>[0];

const resolveColumn = (model: string, field: string): string =>
  columnsByModel[model]?.[field] ?? field;

const runtime = ManagedRuntime.make(
  PgClient.layer({ url: Redacted.make(env.DATABASE_URL) })
);

const run = <A>(
  build: (sql: SqlClient.SqlClient) => Effect.Effect<A, SqlError>
): Promise<A> =>
  runtime.runPromise(
    Effect.gen(function* runStatement() {
      const sql = yield* SqlClient.SqlClient;
      return yield* build(sql);
    })
  );

const column = (name: string): Fragment =>
  Statement.fragment([Statement.identifier(name)]);

const aliasColumn = (
  sql: SqlClient.SqlClient,
  field: string,
  dbColumn: string
): Fragment =>
  field === dbColumn
    ? column(dbColumn)
    : sql`${column(dbColumn)} AS ${column(field)}`;

const selectColumns = (
  sql: SqlClient.SqlClient,
  model: string,
  fields?: string[]
): Fragment => {
  const names =
    fields && fields.length > 0
      ? fields
      : Object.keys(columnsByModel[model] ?? {});

  return names.length === 0
    ? sql.literal("*")
    : sql.csv(
        names.map((field) =>
          aliasColumn(sql, field, resolveColumn(model, field))
        )
      );
};

const mapRow = (
  model: string,
  row: Record<string, unknown>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).map(([field, value]) => [
      resolveColumn(model, field),
      value,
    ])
  );

const matchesInsensitive = (where: CleanedWhere): boolean =>
  where.mode === "insensitive" &&
  (typeof where.value === "string" ||
    (Array.isArray(where.value) &&
      where.value.every((value) => typeof value === "string")));

const arrayValue = (
  value: CleanedWhere["value"]
): readonly (string | number | boolean | Date)[] =>
  Array.isArray(value) ? value : [];

const patternMatch = (
  sql: SqlClient.SqlClient,
  dbColumn: string,
  pattern: string,
  insensitive: boolean
): Fragment =>
  insensitive
    ? sql`${sql(dbColumn)} ILIKE ${pattern}`
    : sql`${sql(dbColumn)} LIKE ${pattern}`;

const buildCondition = (
  sql: SqlClient.SqlClient,
  model: string,
  where: CleanedWhere
): Fragment => {
  const insensitive = matchesInsensitive(where);
  const dbColumn = resolveColumn(model, where.field);
  const field = sql(dbColumn);

  switch (where.operator) {
    case "eq": {
      if (where.value === null) {
        return sql`${field} IS NULL`;
      }
      return insensitive
        ? sql`lower(${field}) = lower(${where.value})`
        : sql`${field} = ${where.value}`;
    }
    case "ne": {
      if (where.value === null) {
        return sql`${field} IS NOT NULL`;
      }
      return insensitive
        ? sql`lower(${field}) <> lower(${where.value})`
        : sql`${field} <> ${where.value}`;
    }
    case "lt": {
      return sql`${field} < ${where.value}`;
    }
    case "lte": {
      return sql`${field} <= ${where.value}`;
    }
    case "gt": {
      return sql`${field} > ${where.value}`;
    }
    case "gte": {
      return sql`${field} >= ${where.value}`;
    }
    case "in": {
      const values = arrayValue(where.value);
      if (values.length === 0) {
        return sql.literal("1=0");
      }
      return insensitive
        ? sql`lower(${field}) IN ${sql.in(
            values.map((value) => String(value).toLowerCase())
          )}`
        : sql.in(dbColumn, values);
    }
    case "not_in": {
      const values = arrayValue(where.value);
      if (values.length === 0) {
        return sql.literal("1=1");
      }
      return insensitive
        ? sql`lower(${field}) NOT IN ${sql.in(
            values.map((value) => String(value).toLowerCase())
          )}`
        : sql`${field} NOT IN ${sql.in(values)}`;
    }
    case "contains": {
      return patternMatch(
        sql,
        dbColumn,
        `%${String(where.value)}%`,
        insensitive
      );
    }
    case "starts_with": {
      return patternMatch(
        sql,
        dbColumn,
        `${String(where.value)}%`,
        insensitive
      );
    }
    case "ends_with": {
      return patternMatch(
        sql,
        dbColumn,
        `%${String(where.value)}`,
        insensitive
      );
    }
    default: {
      const unsupported: never = where.operator;
      throw new Error(`Unsupported where operator: ${String(unsupported)}`);
    }
  }
};

const buildWhere = (
  sql: SqlClient.SqlClient,
  model: string,
  where: readonly CleanedWhere[]
): Fragment => {
  const conjunctive: Fragment[] = [];
  const disjunctive: Fragment[] = [];

  for (const condition of where) {
    const fragment = buildCondition(sql, model, condition);
    if (condition.connector === "OR") {
      disjunctive.push(fragment);
    } else {
      conjunctive.push(fragment);
    }
  }

  if (conjunctive.length > 0 && disjunctive.length > 0) {
    return sql.and([sql.and(conjunctive), sql.or(disjunctive)]);
  }
  if (conjunctive.length > 0) {
    return sql.and(conjunctive);
  }
  if (disjunctive.length > 0) {
    return sql.or(disjunctive);
  }
  return sql.literal("TRUE");
};

const rejectNativeJoin = (join: JoinConfig | undefined): void => {
  if (join && Object.keys(join).length > 0) {
    throw new Error(
      "The effect-sql adapter does not implement native joins. Leave advanced.database.joins disabled so better-auth resolves relations with separate queries."
    );
  }
};

const makeAdapter = ({ getFieldName }: AdapterHelpers): CustomAdapter => {
  const resolveFields = (
    model: string,
    fields: string[] | undefined
  ): string[] | undefined =>
    fields?.map((field) => getFieldName({ field, model }));

  return {
    async count({ model, modelKey = model, where }) {
      const rows = await run(
        (sql) =>
          sql`SELECT COUNT(*)::int AS count FROM ${sql(model)} WHERE ${buildWhere(
            sql,
            modelKey,
            where ?? []
          )}`
      );
      return Number(rows[0]?.count ?? 0);
    },

    async create<T extends Record<string, unknown>>({
      model,
      modelKey = model,
      data,
    }: ModelTarget & { data: T }) {
      const rows = await run(
        (sql) =>
          sql`INSERT INTO ${sql(model)} ${sql
            .insert(mapRow(modelKey, data))
            .returning(selectColumns(sql, modelKey))}`
      );
      return rows[0] as T;
    },

    async delete({ model, modelKey = model, where }) {
      await run(
        (sql) =>
          sql`DELETE FROM ${sql(model)} WHERE ${buildWhere(
            sql,
            modelKey,
            where
          )}`
      );
    },

    async deleteMany({ model, modelKey = model, where }) {
      const rows = await run(
        (sql) =>
          sql`DELETE FROM ${sql(model)} WHERE ${buildWhere(
            sql,
            modelKey,
            where
          )} RETURNING 1`
      );
      return rows.length;
    },

    async findMany<T>({
      model,
      modelKey = model,
      where,
      limit,
      select,
      sortBy,
      offset,
      join,
    }: ModelTarget & {
      where?: CleanedWhere[];
      limit: number;
      select?: string[];
      sortBy?: { field: string; direction: "asc" | "desc" };
      offset?: number;
      join?: JoinConfig;
    }) {
      rejectNativeJoin(join);
      const rows = await run((sql) => {
        const order = sortBy
          ? sql` ORDER BY ${column(
              resolveColumn(
                modelKey,
                getFieldName({ field: sortBy.field, model: modelKey })
              )
            )} ${sql.literal(sortBy.direction === "desc" ? "DESC" : "ASC")}`
          : sql.literal("");
        const skip =
          offset === undefined ? sql.literal("") : sql` OFFSET ${offset}`;
        return sql`SELECT ${selectColumns(
          sql,
          modelKey,
          resolveFields(modelKey, select)
        )} FROM ${sql(model)} WHERE ${buildWhere(
          sql,
          modelKey,
          where ?? []
        )}${order} LIMIT ${limit}${skip}`;
      });
      return rows as T[];
    },

    async findOne<T>({
      model,
      modelKey = model,
      where,
      select,
      join,
    }: ModelTarget & {
      where: CleanedWhere[];
      select?: string[];
      join?: JoinConfig;
    }) {
      rejectNativeJoin(join);
      const rows = await run(
        (sql) =>
          sql`SELECT ${selectColumns(
            sql,
            modelKey,
            resolveFields(modelKey, select)
          )} FROM ${sql(model)} WHERE ${buildWhere(
            sql,
            modelKey,
            where
          )} LIMIT 1`
      );
      return (rows[0] ?? null) as T | null;
    },

    async update<T>({
      model,
      modelKey = model,
      where,
      update,
    }: ModelTarget & { where: CleanedWhere[]; update: T }) {
      const rows = await run(
        (sql) =>
          sql`UPDATE ${sql(model)} SET ${sql.update(
            mapRow(modelKey, update as Record<string, unknown>)
          )} WHERE ${buildWhere(
            sql,
            modelKey,
            where
          )} RETURNING ${selectColumns(sql, modelKey)}`
      );
      return (rows[0] ?? null) as T | null;
    },

    async updateMany({ model, modelKey = model, where, update }) {
      const rows = await run(
        (sql) =>
          sql`UPDATE ${sql(model)} SET ${sql.update(
            mapRow(modelKey, update)
          )} WHERE ${buildWhere(sql, modelKey, where)} RETURNING 1`
      );
      return rows.length;
    },
  };
};

export const effectSqlAdapter = () =>
  createAdapterFactory({
    adapter: (helpers) => makeAdapter(helpers),
    config: {
      adapterId: "effect-sql",
      adapterName: "Effect SQL Adapter",
      supportsArrays: true,
      supportsJSON: true,
      supportsUUIDs: true,
    },
  });
