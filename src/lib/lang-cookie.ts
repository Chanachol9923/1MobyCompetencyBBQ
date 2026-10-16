/**
 * The interface language is remembered as a cookie as well as in local
 * storage, so the server can render the first page in it. This lives in a
 * plain module because the server layout cannot read constants out of a
 * "use client" file — it would receive a client reference, not the string.
 */
export const LANG_COOKIE = "1moby-lang";
