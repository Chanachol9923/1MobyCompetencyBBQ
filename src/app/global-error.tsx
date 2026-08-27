"use client";

/**
 * Replaces the root layout when rendering fails, so the i18n provider is not
 * mounted and `useT()` is unavailable here. Both languages are printed
 * together rather than guessing which one the reader wanted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f7f7",
          color: "#1c1e29",
          margin: 0,
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 8px 36px rgba(16,24,40,.1)",
          }}
        >
          <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>
            The application failed to start
          </h1>
          <p style={{ fontSize: 15, margin: "0 0 12px", color: "#21272a" }}>
            ระบบเริ่มทำงานไม่สำเร็จ
          </p>
          <p style={{ fontSize: 13, color: "#697077", margin: "0 0 20px" }}>
            {error.message || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              background: "#006bff",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload · โหลดใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
