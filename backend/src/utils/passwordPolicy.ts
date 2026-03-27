const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "admin123456",
  "changeme123",
  "letmein123",
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "qwerty123",
  "welcome123",
  "urerb123456",
]);

const WEAK_PASSWORD_PATTERNS = [
  /^([a-zA-Z])\1{5,}$/,
  /^(\d)\1{5,}$/,
  /^(?:1234|abcd|qwer|asdf)/i,
];

export function isPasswordAllowed(password: string, email?: string | null) {
  if (password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;

  const normalized = password.trim().toLowerCase();
  if (!normalized) return false;
  if (COMMON_PASSWORDS.has(normalized)) return false;
  if (WEAK_PASSWORD_PATTERNS.some((pattern) => pattern.test(password))) {
    return false;
  }

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (
    compact === "password" ||
    compact === "changeme" ||
    compact === "letmein" ||
    compact === "qwerty"
  ) {
    return false;
  }

  if (email) {
    const emailLocalPart = email.split("@")[0]?.trim().toLowerCase();
    if (emailLocalPart && normalized.includes(emailLocalPart)) {
      return false;
    }
  }

  return true;
}
