"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { financialApiFetch } from "@/lib/api/client";
import { FALLBACK_CURRENCY, formatMoney } from "@/lib/money";

type CurrencyContextValue = {
  currency: string;
  money: (amount: number | string | null | undefined, currency?: string | null) => string;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: FALLBACK_CURRENCY,
  money: (amount, currency) => formatMoney(amount, currency),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState(FALLBACK_CURRENCY);

  useEffect(() => {
    let active = true;
    financialApiFetch<{ currency?: string }>("/finance/settings")
      .then((s) => {
        if (active && s?.currency) setCurrency(s.currency);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const money = useCallback(
    (amount: number | string | null | undefined, rowCurrency?: string | null) =>
      formatMoney(amount, rowCurrency || currency),
    [currency],
  );

  const value = useMemo(() => ({ currency, money }), [currency, money]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}