// One CSV writer for every export.
//  - every field is quoted and embedded quotes are doubled (a comma/newline in a name can't shift columns)
//  - values starting with = + - @ TAB or CR are prefixed with ' so Excel/Sheets never evaluate them as formulas
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: any): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Plain negative numbers are data, not formulas
  if (FORMULA_PREFIX.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}

export function csvRow(cells: any[]): string {
  return cells.map(csvCell).join(',');
}

export function escapeHtml(value: any): string {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
