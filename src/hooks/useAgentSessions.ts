"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSessions, sessionQuery } from "../agent/api";
import type { AgentDevice, AgentSession, JournalFilters } from "../agent/model";

type State = {
  query: string;
  sessions: AgentSession[];
  devices: AgentDevice[];
  more: boolean;
  offset: number;
  error: string;
  updatedAt: Date | null;
  loading: "replace" | "append" | null;
};
const empty = (query: string): State => ({
  query,
  sessions: [],
  devices: [],
  more: false,
  offset: 0,
  error: "",
  updatedAt: null,
  loading: "replace",
});

export function useAgentSessions(filters: JournalFilters, paused: boolean) {
  const query = sessionQuery(filters);
  const [state, setState] = useState(() => empty(query));
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const request = useCallback(
    async (offset: number) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setState((old) => ({
        ...(old.query === query ? old : empty(query)),
        error: "",
        loading: offset ? "append" : "replace",
      }));
      try {
        const result = await getSessions(query, offset, controller.signal);
        if (controller.signal.aborted) return;
        setState((old) => {
          const previous = offset && old.query === query ? old.sessions : [];
          // A new event can move a session between pages while pagination is in flight.
          const unique = new Map(previous.map((s) => [s.id, s]));
          result.sessions.forEach((s) => unique.set(s.id, s));
          return {
            query,
            sessions: [...unique.values()],
            devices: result.devices,
            more: result.hasMore,
            offset: offset + result.sessions.length,
            error: "",
            loading: null,
            updatedAt: new Date(),
          };
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((old) => ({
            ...old,
            loading: null,
            error: (error as Error).message,
          }));
      } finally {
        if (active.current === controller) active.current = null;
      }
    },
    [query],
  );
  useEffect(() => {
    void request(0);
    return () => active.current?.abort();
  }, [request, revision]);
  useEffect(() => {
    if (paused || state.offset > 50) return;
    const timer = setInterval(() => {
      if (!document.hidden && !active.current) refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [paused, state.offset, refresh]);
  // Never render or export results belonging to a previous filter, even before the effect runs.
  const current = state.query === query ? state : empty(query);
  return {
    ...current,
    busy: current.loading !== null,
    refresh,
    loadMore: () => {
      if (!active.current && current.more) void request(current.offset);
    },
  };
}
