//@ts-nocheck
import type { Metadata } from 'next'
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: { template: '%s | K9Hope', default: 'Find Blood for Your Dog | K9Hope' },
  description: "Submit emergency blood requests for your dog, upload vet documents, and track donor matching status on K9Hope.",
  robots: { index: false, follow: true },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
