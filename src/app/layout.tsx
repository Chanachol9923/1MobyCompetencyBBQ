import type { Metadata } from "next";
import { Geologica } from "next/font/google";
import "./globals.css";
import { UiProvider } from "@/lib/ui-state";
import { Toast } from "@/components/layout/Toast";

const geologica = Geologica({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geologica",
  display: "swap",
});

export const metadata: Metadata = {
  title: "1Moby · Comprehensive Assessment System",
  description:
    "Demo of the 1Moby competency assessment, IDP and LMS platform. All data is mocked.",
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
