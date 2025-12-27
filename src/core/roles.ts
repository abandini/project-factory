// Role definitions for orchestrator discipline
export type Role = "planner" | "executor" | "critic" | "auditor";

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  planner: "Minimal plan + success criteria. No tools.",
  executor: "Execute plan, create artifacts, persist them.",
  critic: "Validate consistency/completeness; demand fixes.",
  auditor: "Secrets hygiene; policy enforcement; block unsafe actions.",
};
