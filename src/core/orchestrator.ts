import { Env } from "./state";
import { makeLogger } from "./logger";

export function makeOrchestrator(_env: Env) {
  const log = makeLogger();
  return {
    log,
    async run<T>(fn: () => Promise<T>): Promise<{ result?: T; error?: string; logs: unknown[] }> {
      try {
        const result = await fn();
        return { result, logs: log.events };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: msg, logs: log.events };
      }
    },
  };
}
