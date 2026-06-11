function parseBackendUtcDate(value: string): Date {
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value);

  // Backend sends UTC timestamps without "Z", so force UTC.
  const normalizedValue = hasTimezone ? value : `${value}Z`;

  return new Date(normalizedValue);
}

export function formatDateET(value: string | null | undefined): string {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parseBackendUtcDate(value));
}