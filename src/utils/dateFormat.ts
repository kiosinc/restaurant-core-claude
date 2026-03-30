/**
 * Formats a Date as YYYY/MM/DD using its UTC (ISO) representation.
 */
export function standardizedDate(date: Date): string {
  const [year, month, day] = date.toISOString().split('T')[0].split('-');
  return `${year}/${month}/${day}`;
}
