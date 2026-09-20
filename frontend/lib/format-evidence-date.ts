/** Display recorded evidence timestamps consistently in UTC. */
export function formatEvidenceDate(
  value: string | null | undefined,
  mode: 'short' | 'date' | 'full' = 'full'
): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short', timeZone: 'UTC',
    ...(mode === 'short' ? {} : { year: 'numeric' }),
    ...(mode === 'date' ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  };
  const formatted = new Intl.DateTimeFormat('en-GB', options).format(date);
  return mode === 'full' ? `${formatted} UTC` : formatted;
}
