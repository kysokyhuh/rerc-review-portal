const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /\d/;
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

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordCriterion = {
  key: "length" | "letterCase" | "number" | "notCommon" | "notEmail";
  label: string;
  satisfied: boolean;
};

function getEmailLocalPart(email?: string | null) {
  return email?.split("@")[0]?.trim().toLowerCase() ?? "";
}

function isCommonOrWeakPassword(password: string) {
  const normalized = password.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    COMMON_PASSWORDS.has(normalized) ||
    WEAK_PASSWORD_PATTERNS.some((pattern) => pattern.test(password)) ||
    compact === "password" ||
    compact === "changeme" ||
    compact === "letmein" ||
    compact === "qwerty"
  );
}

export function getPasswordCriteria(
  password: string,
  email?: string | null
): PasswordCriterion[] {
  const emailLocalPart = getEmailLocalPart(email);
  const normalizedPassword = password.trim().toLowerCase();

  return [
    {
      key: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      satisfied: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      key: "letterCase",
      label: "Upper and lowercase characters",
      satisfied:
        PASSWORD_UPPERCASE_REGEX.test(password) &&
        PASSWORD_LOWERCASE_REGEX.test(password),
    },
    {
      key: "number",
      label: "At least one number",
      satisfied: PASSWORD_NUMBER_REGEX.test(password),
    },
    {
      key: "notCommon",
      label: "Not a common or patterned password",
      satisfied: password.length === 0 || !isCommonOrWeakPassword(password),
    },
    {
      key: "notEmail",
      label: "Does not include your email username",
      satisfied:
        !emailLocalPart ||
        !normalizedPassword.includes(emailLocalPart),
    },
  ];
}

export function passwordMeetsRules(password: string, email?: string | null) {
  return getPasswordCriteria(password, email).every((criterion) => criterion.satisfied);
}

export function getPasswordStrength(password: string, email?: string | null) {
  const criteria = getPasswordCriteria(password, email);
  const satisfiedCount = criteria.filter((criterion) => criterion.satisfied).length;

  if (password.length === 0) {
    return {
      tone: "empty" as const,
      label: "Start typing",
      progress: 0,
      criteria,
    };
  }

  if (satisfiedCount <= 1) {
    return {
      tone: "weak" as const,
      label: "Weak",
      progress: 34,
      criteria,
    };
  }

  if (satisfiedCount === 2) {
    return {
      tone: "fair" as const,
      label: "Fair",
      progress: 68,
      criteria,
    };
  }

  return {
    tone: "strong" as const,
    label: "Strong",
    progress: 100,
    criteria,
  };
}
