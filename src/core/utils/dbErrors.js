// admin-panel/src/core/utils/dbErrors.js
//
// Small helpers for the defensive schema fallbacks used by the payroll and
// employee repositories. PostgREST reports missing columns in a few different
// shapes depending on whether the error comes from Postgres or the schema
// cache, so we normalise the column name here.

export function errorMessage(error) {
  return String(error?.message ?? error ?? '');
}

export function isMissingTable(error) {
  return /relation .* does not exist|could not find the table|schema cache/i.test(
    errorMessage(error)
  );
}

/**
 * Returns the column name from a "missing column" error, limited to the
 * columns we actually asked for. Returns null for any other error.
 */
export function missingColumnName(error, knownColumns = []) {
  const message = errorMessage(error);
  const patterns = [
    /column\s+(?:[\w"]+\.)?"?([\w]+)"?\s+does not exist/i,
    /Could not find the '([^']+)' column/i,
    /column\s+"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const name = match?.[1];
    if (!name) continue;
    if (knownColumns.length === 0 || knownColumns.includes(name)) {
      return name;
    }
  }

  return null;
}
