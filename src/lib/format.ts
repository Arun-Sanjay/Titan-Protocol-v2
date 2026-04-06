import { getJSON, setJSON } from "../db/storage";

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function getSelectedCurrency(): CurrencyCode {
  return getJSON<CurrencyCode>("selected_currency", "USD");
}

export function setSelectedCurrency(code: CurrencyCode): void {
  setJSON("selected_currency", code);
}

export function formatCurrency(val: number): string {
  const code = getSelectedCurrency();
  const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
  const noDecimals = code === "JPY";

  if (val == null || !Number.isFinite(val)) return currency.symbol + (noDecimals ? "0" : "0.00");

  const abs = Math.abs(val);
  const fixed = noDecimals ? Math.round(abs).toString() : abs.toFixed(2);
  const formatted = currency.symbol + fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return val < 0 ? "-" + formatted : formatted;
}
