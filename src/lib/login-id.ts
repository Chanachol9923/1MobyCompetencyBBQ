/**
 * Company login ids: name.sur@1moby.com — the first name, a dot, and the first
 * three letters of the surname, lower-case.
 *
 * The administrator assigns the id; this only proposes one and checks the shape.
 * Shared by the admin screens, the import and the seed, so all three agree.
 */

export const LOGIN_DOMAIN = (
  process.env.NEXT_PUBLIC_LOGIN_DOMAIN ?? "1moby.com"
).toLowerCase();

/** Letters only, lower-case, accents stripped. Thai script yields nothing. */
function slug(part: string): string {
  return part
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Proposal only — returns null when the romanised name is not usable. */
export function suggestLoginId(
  firstName: string,
  lastName: string,
  taken: ReadonlySet<string> = new Set(),
): string | null {
  const first = slug(firstName);
  const sur = slug(lastName).slice(0, 3);
  if (!first) return null;
  const base = sur ? `${first}.${sur}` : first;
  let candidate = `${base}@${LOGIN_DOMAIN}`;
  // on a clash add a digit, the way most mail systems do
  for (let n = 2; taken.has(candidate) && n < 100; n++) {
    candidate = `${base}${n}@${LOGIN_DOMAIN}`;
  }
  return candidate;
}

export function normaliseLoginId(value: string): string {
  return value.trim().toLowerCase();
}

/** name.sur@1moby.com — letters, one dot, optional digits, the company domain. */
export function isValidLoginId(value: string): boolean {
  const v = normaliseLoginId(value);
  const escaped = LOGIN_DOMAIN.replace(/[.]/g, "\\.");
  return new RegExp(`^[a-z]+(\\.[a-z]+)?[0-9]{0,2}@${escaped}$`).test(v);
}
