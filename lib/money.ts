export const FALLBACK_CURRENCY = 'SDG';

export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  const code = (currency || FALLBACK_CURRENCY).toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${code} ${safe.toFixed(2)}`;
  }
}

export function formatPlain(amount: number | string | null | undefined): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}