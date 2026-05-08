import { format, parseISO, subMonths } from "date-fns";
import { it } from "date-fns/locale";

export function fmt(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);
}

export function fmtCompactCurrency(amount: number, currency = "EUR") {
  const symbol = currency === "EUR" ? "\u20ac" : currency;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) return `${sign}${formatCompactValue(abs / 1_000_000)}M ${symbol}`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K ${symbol}`;

  return `${sign}${Math.round(abs)} ${symbol}`;
}

export function fmtShort(value: number) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatCompactValue(value: number) {
  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1);
  return rounded.replace(".", ",").replace(",0", "");
}

export function getMonthLabel(month: string) {
  try {
    return format(parseISO(`${month}-01`), "MMMM yyyy", { locale: it });
  } catch {
    return month;
  }
}

export function getShortMonthLabel(month: string) {
  try {
    return format(parseISO(`${month}-01`), "MMM yy", { locale: it });
  } catch {
    return month;
  }
}

export function prevMonth(month: string) {
  try {
    return format(subMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
  } catch {
    return month;
  }
}

export function nextMonth(month: string) {
  try {
    const date = parseISO(`${month}-01`);
    date.setMonth(date.getMonth() + 1);
    return format(date, "yyyy-MM");
  } catch {
    return month;
  }
}
