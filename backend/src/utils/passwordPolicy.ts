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

export function getPasswordPolicyFailure(password: string, email?: string | null) {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";

  const normalized = password.trim().toLowerCase();
  if (!normalized) return "Password is required.";
  if (COMMON_PASSWORDS.has(normalized)) return "Password is too common.";
  if (WEAK_PASSWORD_PATTERNS.some((pattern) => pattern.test(password))) {
    return "Password uses a common weak pattern.";
  }

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (
    compact === "password" ||
    compact === "changeme" ||
    compact === "letmein" ||
    compact === "qwerty"
  ) {
    return "Password is too common.";
  }

  if (email) {
    const emailLocalPart = email.split("@")[0]?.trim().toLowerCase();
    if (emailLocalPart && normalized.includes(emailLocalPart)) {
      return "Password cannot include the email username.";
    }
  }

  return null;
}

export function isPasswordAllowed(password: string, email?: string | null) {
  return getPasswordPolicyFailure(password, email) === null;
}
