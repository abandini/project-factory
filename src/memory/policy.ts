export function allowMemory(text: string): { allowed: boolean; reason?: string } {
  const lowered = text.toLowerCase();
  const forbidden = ["api key", "password", "secret", "private key", "ssn"];
  if (forbidden.some(f => lowered.includes(f))) {
    return { allowed: false, reason: "Contains sensitive secret-like content." };
  }
  return { allowed: true };
}
