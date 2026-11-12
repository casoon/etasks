// @core

/**
 * Escapes one CSV cell (semicolon separated). Text starting with = + - @ tab or CR is
 * prefixed with ' so Excel does not run it as a formula; real numbers (type number) are
 * written as they are, so negative values stay numeric.
 */
export function csvEscape(value: string | number | null | undefined): string {
  const isNumber = typeof value === "number";
  let normalized = String(value ?? "");
  if (!isNumber && /^[=+\-@\t\r]/.test(normalized)) normalized = `'${normalized}`;
  return /[",;\r\n]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}
