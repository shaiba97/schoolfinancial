"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";

export type FinanceRealtimeKind = "payment.recorded";

type TicketResponse = { ticket: string; expiresIn: number };

type SocketState =
  | { status: "connecting" }
  | { status: "live"; socket: Socket }
  | { status: "offline" };

export function useFinanceRealtimeEvent(
  kinds: FinanceRealtimeKind | FinanceRealtimeKind[],
  handlers: {
    onEvent: (kind: FinanceRealtimeKind, payload: unknown) => void;
    onReconnect: () => void;
  },
  opts?: { enabled?: boolean },
) {
  const [state, setState] = React.useState<SocketState>({ status: "connecting" });
  const enabled = opts?.enabled ?? true;
  const kindsKey = (Array.isArray(kinds) ? kinds : [kinds]).join(",");
  const handlersRef = React.useRef(handlers);

  React.useEffect(() => {
    handlersRef.current = handlers;
  });

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: Socket | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let dropped = false;
    let refreshing = false;

    async function fetchTicket(): Promise<TicketResponse | null> {
      try {
        const response = await fetch("/api/session/socket-ticket", { cache: "no-store" });
        if (!response.ok) return null;
        return (await response.json()) as TicketResponse;
      } catch {
        return null;
      }
    }

    function clearTimers() {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      refreshTimer = null;
      retryTimer = null;
    }

    async function connect() {
      if (cancelled) return;
      const data = await fetchTicket();
      if (cancelled) return;
      if (!data) {
        setState({ status: "offline" });
        retryTimer = setTimeout(() => void connect(), 30_000);
        return;
      }

      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "https://schoolbackend-7n8a.onrender.com", {
        auth: { token: data.ticket },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5,
        timeout: 8000,
      });

      socket.on("connect", () => {
        if (cancelled) return;
        setState({ status: "live", socket: socket as Socket });
        if (dropped && !refreshing) handlersRef.current.onReconnect();
        dropped = false;
        refreshing = false;
      });
      socket.on("disconnect", () => {
        if (cancelled) return;
        dropped = true;
        setState({ status: "offline" });
      });
      socket.on("connect_error", () => {
        if (!cancelled) setState({ status: "offline" });
      });
      for (const kind of kindsKey.split(",")) {
        socket.on(kind, (payload: unknown) => handlersRef.current.onEvent(kind as FinanceRealtimeKind, payload));
      }

      refreshTimer = setTimeout(
        () => {
          if (cancelled) return;
          refreshing = true;
          socket?.disconnect();
          socket = null;
          void connect();
        },
        Math.max(30_000, (data.expiresIn - 30) * 1000),
      );
    }

    function onFocus() {
      if (socket?.connected) return;
      clearTimers();
      void connect();
    }

    void connect();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearTimers();
      socket?.disconnect();
      socket = null;
    };
  }, [enabled, kindsKey]);

  return state;
}
