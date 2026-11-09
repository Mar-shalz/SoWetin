export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'late_night';

// BR-01, BR-02: the meal time for an instant, in the business time zone. Pure: the caller passes the instant.
export function mealTimeAt(at: Date, windows: Record<MealTime, string>, timeZone: string): MealTime {
  const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(at);
  const starts = (Object.entries(windows) as [MealTime, string][]).sort((a, b) => a[1].localeCompare(b[1]));
  // Before the first window opens we're still in the last one: late night runs past midnight.
  let current = starts[starts.length - 1][0];
  for (const [meal, start] of starts) if (hhmm >= start) current = meal;
  return current;
}
