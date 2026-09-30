/**
 * Supabase only accepts TLS. With DATABASE_CA_CERT (the PEM from Supabase →
 * Database Settings → SSL) the server certificate is verified; without it the
 * link is still encrypted but the certificate is not pinned. A local database
 * gets no TLS at all.
 */
export function sslFor(url: string) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return undefined;
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
