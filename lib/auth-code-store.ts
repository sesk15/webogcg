import crypto from "crypto";

const CODE_STORE = new Map<string, { userId: string; createdAt: number }>();
const CODE_TTL_MS = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of CODE_STORE.entries()) {
    if (now - entry.createdAt > CODE_TTL_MS) {
      CODE_STORE.delete(code);
    }
  }
}, 30000);

export function generateCode(userId: string): string {
  const code = crypto.randomBytes(32).toString("hex");
  CODE_STORE.set(code, { userId, createdAt: Date.now() });
  return code;
}

export function consumeCode(code: string): { userId: string } | null {
  const entry = CODE_STORE.get(code);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CODE_TTL_MS) {
    CODE_STORE.delete(code);
    return null;
  }
  CODE_STORE.delete(code);
  return { userId: entry.userId };
}
