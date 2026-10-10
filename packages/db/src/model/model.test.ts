import { describe, expect, test } from "bun:test";

import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import * as drizzleSchema from "../schema/index";
import { modelTables } from "./index";

const drizzleTables = new Map<string, PgTable>();
for (const [name, value] of Object.entries(drizzleSchema)) {
  if (is(value, PgTable)) {
    drizzleTables.set(name, value);
  }
}

test("every drizzle table has a model declaration", () => {
  expect(
    [...drizzleTables.keys()].filter((name) => !(name in modelTables))
  ).toEqual([]);
});

describe("model column names", () => {
  for (const [name, model] of Object.entries(modelTables)) {
    test(`${name} matches the drizzle schema`, () => {
      const table = drizzleTables.get(name);
      if (!table) {
        throw new Error(`No drizzle table exported as ${name}`);
      }
      const expected: Record<string, string> = Object.fromEntries(
        Object.entries(getTableColumns(table)).map(([field, column]) => [
          field,
          column.name,
        ])
      );
      const actual: Record<string, string> = model.columns;
      expect(actual).toEqual(expected);
      expect(Object.keys(model.row.fields).toSorted()).toEqual(
        Object.values(expected).toSorted()
      );
    });
  }
});
