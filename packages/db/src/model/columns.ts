interface RenamedRow {
  readonly from: { readonly fields: Readonly<Record<string, unknown>> };
  readonly to: { readonly fields: Readonly<Record<string, unknown>> };
}

export const fieldColumns = (row: RenamedRow): Record<string, string> => {
  const columns = Object.keys(row.from.fields);
  return Object.fromEntries(
    Object.keys(row.to.fields).map((field, index): [string, string] => [
      field,
      columns[index] ?? field,
    ])
  );
};
