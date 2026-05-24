export function sanitiseInput(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous\s+)?instructions?/gi, '[filtered]')
    .replace(/you\s+are\s+now/gi, '[filtered]')
    .replace(/act\s+as\s+(a\s+)?/gi, '[filtered]')
    .replace(/\[?system\]?\s*:/gi, '[filtered]')
    .replace(/disregard\s+(previous\s+)?/gi, '[filtered]')
    .replace(/pretend\s+you\s+(are|have)/gi, '[filtered]')
    .trim();
}

export function detectPII(text: string) {
  const patterns = {
    aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/,
    pan: /\b[A-Z]{5}\d{4}[A-Z]\b/,
    phone: /\b[6-9]\d{9}\b/,
    email: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  };

  return Object.entries(patterns)
    .filter(([_, p]) => p.test(text))
    .map(([type]) => type);
}
