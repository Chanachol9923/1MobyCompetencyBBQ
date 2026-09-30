import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UiProvider } from "@/lib/ui-state";
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
  title: "1Moby · Comprehensive Assessment System",
  description:
    "1Moby competency assessment, individual development plans and learning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geologica.variable}>
      <body className="min-h-screen bg-white antialiased">
        <UiProvider>
          {children}
          <Toast />
        </UiProvider>
      </body>
    </html>
  );
}
