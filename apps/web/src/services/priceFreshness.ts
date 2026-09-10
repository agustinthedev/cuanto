export const LATEST_PRICE_MAX_AGE_DAYS = 1;

const URUGUAY_TIME_ZONE = "America/Montevideo";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function uruguayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: URUGUAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateDayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const dayNumber = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsedDate = new Date(dayNumber);
  if (
    parsedDate.getUTCFullYear() !== Number(match[1])
    || parsedDate.getUTCMonth() !== Number(match[2]) - 1
    || parsedDate.getUTCDate() !== Number(match[3])
  ) return null;
  return dayNumber;
}

export function isLatestPriceFresh(priceDate: string, today = uruguayDate()): boolean {
  const priceDay = dateDayNumber(priceDate);
  const todayDay = dateDayNumber(today);
  if (priceDay === null || todayDay === null || priceDay > todayDay) return false;
  const ageInDays = Math.floor((todayDay - priceDay) / MILLISECONDS_PER_DAY);
  return ageInDays <= LATEST_PRICE_MAX_AGE_DAYS;
}
