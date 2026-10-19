import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { UiProvider } from "@/lib/ui-state";
import { LANG_COOKIE } from "@/lib/lang-cookie";
import { Toast } from "@/components/layout/Toast";

// Self-hosted from npm rather than fetched from Google Fonts at build time, so
// a build never depends on (or breaks with) the Google Fonts CSS format.
const geologica = localFont({
  src: "../../node_modules/@fontsource-variable/geologica/files/geologica-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geologica",
  display: "swap",
});

export const metadata: Metadata = {
  // a page names itself ("IDP") and gets the suffix; pages without one show the product name
  title: { template: "%s · 1Moby", default: "1Moby · Comprehensive Assessment System" },
  description:
    "1Moby competency assessment, individual development plans and learning.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // the language is a cookie as well as a local preference, so the server
  // renders the page in Thai straight away instead of flashing English first
  const lang = (await cookies()).get(LANG_COOKIE)?.value === "th" ? "th" : "en";
  return (
    <html lang={lang} className={geologica.variable}>
      <body className="min-h-screen bg-white antialiased">
        <UiProvider initialLang={lang}>
          {children}
          <Toast />
        </UiProvider>
      </body>
    </html>
  );
}
