import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { useEffect } from "react";
import { UserProvider, useUser } from "@/context/UserContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "K9Hope - Canine Blood Donation Network",
  description: "India's first AI-powered canine blood donation network. Connect dogs needing blood with healthy donors in Chennai & Tamil Nadu.",
  keywords: ["canine blood donation", "dog blood bank", "K9Hope", "veterinary", "Chennai", "Tamil Nadu"],
  authors: [{ name: "RIT Chennai CSE - K9Hope Team" }],
  metadataBase: new URL("https://k9hope.in"),
  openGraph: {
    title: "K9Hope - Save Dogs' Lives",
    description: "Connect dogs needing blood with healthy donors. AI-powered matching in 12 minutes.",
    url: "https://k9hope.in",
    siteName: "K9Hope",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "K9Hope - Canine Blood Donation Network",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "K9Hope - Canine Blood Donation Network",
    description: "India's first AI-powered canine blood donation network",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://k9hope.in",
  },
};

// Component to update device type


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <UserProvider>
      <SettingsProvider>
        <html lang="en" suppressHydrationWarning>
          <head>
            <link rel="icon" href="/k9hope-paw-icon.svg" />
            <link rel="apple-touch-icon" href="/k9hope-logo-192.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></meta>
          </head>

          <body className={inter.className}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >

              {children}
            </ThemeProvider>
            <Toaster />
          </body>
        </html>
      </SettingsProvider>
    </UserProvider>
  );
}
