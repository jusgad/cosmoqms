import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/client";
import "./globals.css";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: "CosmoQMS",
  description: "Sistema interno de producción y calidad (MES/QMS) para laboratorio cosmético",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Sign-in stays on our own /login page (Clerk's hosted page lives on
    // another domain and confuses people). Sign-up keeps Clerk's page: new
    // accounts are rare and wait for an administrator anyway.
    <ClerkProvider signInUrl="/login" signInFallbackRedirectUrl="/dashboard">
      <html lang="es" className={`${firaSans.variable} ${firaCode.variable}`}>
        <body className="bg-background font-sans text-foreground antialiased">
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
