/**
 * The rules a new password must meet. Kept free of Node imports so the form
 * can show them live, and the server re-checks with the very same function.
 */

export type PasswordProblem = "too_short" | "too_long" | "needs_letter" | "needs_digit";

export function passwordProblems(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < 10) problems.push("too_short");
  if (password.length > 128) problems.push("too_long");
  if (!/[A-Za-z]/.test(password)) problems.push("needs_letter");
  if (!/[0-9]/.test(password)) problems.push("needs_digit");
  return problems;
}
