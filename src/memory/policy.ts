export function allowMemory(text: string): { allowed: boolean; reason?: string } {
  // Only block actual secret-like patterns, not conceptual mentions
  // These patterns match actual API keys, tokens, etc.
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/, // OpenAI-style keys
    /sk-or-v1-[a-zA-Z0-9]{40,}/, // OpenRouter keys
    /sk-ant-[a-zA-Z0-9]{40,}/, // Anthropic keys
    /AIza[a-zA-Z0-9_-]{35}/, // Google API keys
    /xai-[a-zA-Z0-9]{40,}/, // Grok keys
    /ghp_[a-zA-Z0-9]{36}/, // GitHub tokens
    /gho_[a-zA-Z0-9]{36}/, // GitHub OAuth tokens
    /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/, // SSN pattern
    /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, // Private keys
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      return { allowed: false, reason: "Contains actual secret-like pattern." };
    }
  }

  return { allowed: true };
}
