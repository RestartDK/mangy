import { describe, expect, test } from "bun:test";

import { Effect, Schema } from "effect";

import { decodeModelRows } from "./model-rows";

const at = new Date("2025-01-01T00:00:00.000Z");

const userRow = {
  createdAt: at,
  email: "reader@example.com",
  emailVerified: false,
  id: "user-1",
  image: null,
  name: "Reader",
  updatedAt: at,
};

describe("decodeModelRows", () => {
  test("validates a matching row and returns plain values", async () => {
    const [row] = await Effect.runPromise(
      decodeModelRows<typeof userRow>("user", undefined, [userRow])
    );

    expect(row).toEqual(userRow);
    expect(row?.image).toBeNull();
  });

  test("rejects a row that does not match the model", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        decodeModelRows("user", undefined, [
          { ...userRow, emailVerified: "not-a-boolean" },
        ])
      )
    );

    expect(failure).toBeInstanceOf(Schema.SchemaError);
  });

  test("rejects a column that the model does not declare", async () => {
    let failure: unknown;
    try {
      await Effect.runPromise(
        decodeModelRows("user", ["not_a_user_field"], [{ id: "user-1" }])
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    if (failure instanceof Error) {
      expect(failure.message).toContain("not_a_user_field");
    }
  });
});
