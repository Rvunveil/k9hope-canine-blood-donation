//@ts-nocheck
import type { Metadata } from 'next'
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: { template: '%s | K9Hope Organisation Portal', default: 'Organisation Portal | K9Hope' },
  description: "Coordinate canine blood donation drives, manage donor pools, and support veterinary clinics across Tamil Nadu.",
  robots: { index: false, follow: true },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
