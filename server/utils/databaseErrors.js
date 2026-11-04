export function isUniqueConstraintError(error) {
  return error?.code === "SQLITE_CONSTRAINT_UNIQUE"
    || error?.extendedCode === "SQLITE_CONSTRAINT_UNIQUE"
    || error?.rawCode === 2067
    || (error?.code === "SQLITE_CONSTRAINT" && /UNIQUE constraint failed/i.test(error.message));
}
