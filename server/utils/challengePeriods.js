const mountainDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit",
});

export function getMountainDate(now = new Date()) {
  const parts = Object.fromEntries(mountainDate.formatToParts(now).map(part => [part.type, part.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}

export function getDailyPeriod(now = new Date()) {
  return { date: getMountainDate(now) };
}

export function getWeeklyPeriod(now = new Date()) {
  // Work with civil dates after extracting Mountain time, never a fixed UTC offset.
  const sunday = new Date(getMountainDate(now) + "T00:00:00Z");
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  const date = sunday.toISOString().slice(0, 10);
  sunday.setUTCDate(sunday.getUTCDate() + 7);
  return { date, endDate: sunday.toISOString().slice(0, 10) };
}
