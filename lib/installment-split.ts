export function splitIntoInstallments(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total < 0) return [];
  if (!Number.isInteger(count) || count < 1) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    out.push((base + extra) / 100);
  }
  return out;
}