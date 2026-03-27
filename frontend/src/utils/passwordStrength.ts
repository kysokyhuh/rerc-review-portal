const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /\d/;

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordCriterion = {
  key: "length" | "letterCase" | "number";
  label: string;
  satisfied: boolean;
};

export function getPasswordCriteria(password: string): PasswordCriterion[] {
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
  ];
}

export function passwordMeetsRules(password: string) {
  return getPasswordCriteria(password).every((criterion) => criterion.satisfied);
}

export function getPasswordStrength(password: string) {
  const criteria = getPasswordCriteria(password);
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
