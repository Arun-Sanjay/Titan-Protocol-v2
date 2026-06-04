/**
 * Currency formatting utilities for Titan Protocol.
 */

export type MoneyCurrency = "USD" | "EUR" | "GBP" | "INR";

const CURRENCY_SYMBOLS: Record<MoneyCurrency, string> = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
  INR: "\u20B9",
};

/**
 * Format a numeric amount with the appropriate currency symbol.
 */
export function formatMoney(amount: number, currency: MoneyCurrency = "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Alias for formatMoney — used in some components.
 */
export function formatCurrency(amount: number, currency: MoneyCurrency = "USD"): string {
  return formatMoney(amount, currency);
}
