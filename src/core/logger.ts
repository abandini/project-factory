export type LogEvent = { ts: string; level: "info" | "warn" | "error"; msg: string; meta?: unknown };

export function makeLogger() {
  const events: LogEvent[] = [];
  return {
    info(msg: string, meta?: unknown) {
      events.push({ ts: new Date().toISOString(), level: "info", msg, meta });
    },
    warn(msg: string, meta?: unknown) {
      events.push({ ts: new Date().toISOString(), level: "warn", msg, meta });
    },
    error(msg: string, meta?: unknown) {
      events.push({ ts: new Date().toISOString(), level: "error", msg, meta });
    },
    events,
  };
}
