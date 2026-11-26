const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function parseMonth(value: string | null): string | null {
  if (value === null || !monthPattern.test(value)) {
    return null;
  }
  return value;
}

export function parseAvailabilityDate(value: string | null): string | null {
  if (value === null || !datePattern.test(value) || !isRealDate(value)) {
    return null;
  }
  return value;
}
