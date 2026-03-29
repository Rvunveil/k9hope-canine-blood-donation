//@ts-nocheck
import type { Metadata } from 'next'
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: { template: '%s | K9Hope Donor Portal', default: 'Donor Portal | K9Hope' },
  description: "Manage your dog's blood donation profile, track donation history, and receive emergency donor alerts on K9Hope.",
  robots: { index: false, follow: true },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
