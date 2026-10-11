import { schemasByModel } from "@mangy/db/model";
import { Effect, Schema } from "effect";

/**
 * `CustomAdapter` is generic over the caller's model type while the runtime
 * model is only known by name. This overload lets {@link decodeModelRows}
 * describe the rows in the caller's type; the implementation returns the
 * matching registered schema, and every value still flows through that
 * schema's decoder and encoder, so a row that does not match the model fails
 * loudly instead of being asserted through to better-auth.
 */
function modelRowCodec<T>(
  model: string,
  fields: readonly string[] | undefined
): Schema.Codec<unknown, T>;
function modelRowCodec(
  model: string,
  fields: readonly string[] | undefined
): Schema.Top {
  const modelSchema = schemasByModel[model];
  if (modelSchema === undefined) {
    throw new Error(
      `No Effect Schema is registered for model "${model}"; refusing to return unvalidated rows.`
    );
  }

  if (fields === undefined || fields.length === 0) {
    return modelSchema;
  }

  return Schema.Struct(
    Object.fromEntries(
      fields.map((field) => {
        const fieldSchema = modelSchema.fields[field];
        if (fieldSchema === undefined) {
          throw new Error(
            `Model "${model}" has no field "${field}"; refusing to return an unvalidated column.`
          );
        }

        return [field, fieldSchema];
      })
    )
  );
}

/**
 * Validates rows selected from a model against that model's Effect Schema and
 * re-encodes them to the plain row shape better-auth consumes. Decoding rejects
 * values that do not match the model, so callers never receive an asserted
 * object.
 */
export const decodeModelRows = <T>(
  model: string,
  fields: readonly string[] | undefined,
  rows: readonly unknown[]
): Effect.Effect<T[], Schema.SchemaError> =>
  Effect.gen(function* decodeModelRowsEffect() {
    const codec = modelRowCodec<T>(model, fields);
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(codec))(
      rows
    );
    const encoded = yield* Schema.encodeEffect(Schema.Array(codec))(decoded);

    return [...encoded];
  });
