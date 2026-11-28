export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Empty" | "Too short" | "Fair" | "Good" | "Strong";
  hint: string;
  color: string;
}

export function evaluatePasswordStrength(
  password: string | null | undefined,
): PasswordStrengthResult {
  const pwd = password ?? "";
  if (pwd.length === 0) {
    return {
      score: 0,
      label: "Empty",
      hint: "",
      color: "var(--spark-border)",
    };
  }
  if (pwd.length < 8) {
    return {
      score: 1,
      label: "Too short",
      hint: `${8 - pwd.length} more character${8 - pwd.length === 1 ? "" : "s"} needed`,
      color: "var(--spark-orange, #ef5a2a)",
    };
  }

  let variety = 0;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) variety += 1;
  if (/\d/.test(pwd)) variety += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) variety += 1;
  if (pwd.length >= 12) variety += 1;

  if (variety <= 1) {
    return {
      score: 2,
      label: "Fair",
      hint: "Add numbers, symbols, or mixed case for stronger security",
      color: "#f59e0b",
    };
  }
  if (variety === 2) {
    return {
      score: 3,
      label: "Good",
      hint: "Meets length and complexity requirements",
      color: "var(--spark-ok-ink, #22c55e)",
    };
  }
  return {
    score: 4,
    label: "Strong",
    hint: "Strong password",
    color: "var(--spark-lime, #94e040)",
  };
}
