import { Schema } from "effect";

export interface Column {
  readonly column: string;
  readonly schema: Schema.Constraint;
  readonly nullable?: boolean;
}

export type Columns = Record<string, Column>;

type RowField<C extends Column> = C["nullable"] extends true
  ? Schema.NullOr<C["schema"]>
  : C["schema"];

export type RowFields<D extends Columns> = {
  readonly [K in keyof D as D[K]["column"]]: RowField<D[K]>;
};

export type FieldColumns<D extends Columns> = {
  readonly [K in keyof D]: D[K]["column"];
};

const buildRowFields = <const D extends Columns>(
  declaration: D
): RowFields<D> =>
  Object.fromEntries(
    Object.values(declaration).map(({ column, schema, nullable }) => [
      column,
      nullable ? Schema.NullOr(schema) : schema,
    ])
  ) as RowFields<D>;

const buildColumns = <const D extends Columns>(
  declaration: D
): FieldColumns<D> =>
  Object.fromEntries(
    Object.entries(declaration).map(([field, { column }]) => [field, column])
  ) as FieldColumns<D>;

export const defineTable = <const D extends Columns>(declaration: D) => ({
  columns: buildColumns(declaration),
  row: Schema.Struct(buildRowFields(declaration)),
});
