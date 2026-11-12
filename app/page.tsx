import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "K9HOPE: Open-source canine blood donation network",
  description:
    "K9HOPE connects dogs that need blood with eligible canine donors, supports veterinary coordination, and publishes research on forecasting sparse blood demand. Open source, started in Chennai.",
  alternates: { canonical: "https://k9hope.in" },
  openGraph: {
    title: "K9HOPE: Every second matters. Every donor can change a life.",
    description:
      "An open-source canine blood donation network with veterinary coordination, donor matching and award-winning forecasting research.",
    url: "https://k9hope.in",
    siteName: "K9HOPE",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "K9HOPE donor network illustration" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K9HOPE: Open-source canine blood donation network",
    description: "Connecting dogs that need blood with eligible donors. Started in Chennai, built in the open.",
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "K9HOPE",
  url: "https://k9hope.in",
  description: "Open-source canine blood donation and management platform originating in Chennai, India.",
  sameAs: ["https://github.com/Rvunveil/k9hope-canine-blood-donation"],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingPage />
    </>
  );
}
