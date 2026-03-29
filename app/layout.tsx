import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { UserProvider } from "@/context/UserContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://k9hope.in'),
  title: {
    default: 'K9Hope — India\'s Canine Blood Donation & Management Platform',
    template: '%s | K9Hope',
  },
  description:
    'K9Hope is India\'s first open-source, AI-powered canine blood donation network. ' +
    'Connects dogs needing emergency transfusions with eligible donors in Chennai & Tamil Nadu. ' +
    'Features DEA blood type matching, DAHD 2025 compliance, ZICP inventory forecasting, ' +
    'OCR-based medical triage, and geospatial donor matching. Partner: Madras Veterinary College.',
  keywords: [
    'canine blood donation India',
    'dog blood bank',
    'K9Hope',
    'veterinary blood management system',
    'canine blood donation system open source',
    'dog blood donation Chennai',
    'DEA blood type',
    'canine transfusion',
    'veterinary software India',
    'dog blood bank Tamil Nadu',
    'animal blood donation platform',
    'open source veterinary platform',
    'canine blood matching AI',
    'DAHD 2025 compliance',
    'Madras Veterinary College',
    'RIT Chennai',
    'dog emergency blood',
    'veterinary fintech India',
  ],
  authors: [
    { name: 'Vikram T', url: 'https://github.com/Rvunveil' },
    { name: 'Prem Kumar' },
    { name: 'Ram Kishore' },
    { name: 'Pandithurai O — RIT Chennai CSE' },
  ],
  creator: 'RIT Chennai — Department of Computer Science & Engineering',
  publisher: 'K9Hope Project',
  category: 'veterinary technology',
  classification: 'Healthcare / Veterinary / Open Source',
  applicationName: 'K9Hope',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'K9Hope — India\'s Canine Blood Donation Network',
    description:
      'Open-source AI platform connecting dogs needing blood with eligible donors. ' +
      'DEA blood type matching, 12-min response, DAHD-compliant. Chennai, Tamil Nadu.',
    url: 'https://k9hope.in',
    siteName: 'K9Hope',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'K9Hope — India\'s Canine Blood Donation & Management Platform',
        type: 'image/png',
      },
    ],
    locale: 'en_IN',
    type: 'website',
    countryName: 'India',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K9Hope — India\'s Canine Blood Donation Network',
    description:
      'India\'s first open-source AI canine blood donation platform. DEA blood type matching, ' +
      '12-min response. Chennai & Tamil Nadu. Built by RIT Chennai × Madras Veterinary College.',
    images: ['/api/og'],
    creator: '@k9hope',
    site: '@k9hope',
  },
  alternates: {
    canonical: 'https://k9hope.in',
    languages: {
      'en-IN': 'https://k9hope.in',
    },
  },
  verification: {
    // Replace with your actual Google Search Console verification code
    google: 'REPLACE_WITH_YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE',
  },
  other: {
    'msapplication-TileColor': '#dc2626',
    'theme-color': '#dc2626',
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
            <link rel="manifest" href="/manifest.json" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
            <meta name="theme-color" content="#dc2626" />
            <meta name="geo.region" content="IN-TN" />
            <meta name="geo.placename" content="Chennai, Tamil Nadu, India" />
            <meta name="geo.position" content="13.0827;80.2707" />
            <meta name="ICBM" content="13.0827, 80.2707" />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@graph": [
                    {
                      "@type": "SoftwareApplication",
                      "@id": "https://k9hope.in/#software",
                      "name": "K9Hope",
                      "alternateName": "K9Hope Canine Blood Donation Network",
                      "url": "https://k9hope.in",
                      "applicationCategory": "HealthApplication",
                      "applicationSubCategory": "Veterinary Software",
                      "operatingSystem": "Web",
                      "description": "India's first open-source AI-powered canine blood donation and management platform. Connects dogs needing emergency blood transfusions with eligible donors using DEA blood type matching, geospatial algorithms, and DAHD 2025 veterinary compliance.",
                      "featureList": [
                        "AI-powered canine blood donor matching",
                        "DEA blood type system (DEA 1.1, 1.2, 3, 4, 5, 7)",
                        "DAHD 2025 veterinary compliance automation",
                        "OCR + NLP medical document triage",
                        "Geospatial donor matching (Haversine formula)",
                        "ZICP inventory forecasting",
                        "Real-time blood inventory management",
                        "Multi-portal: hospital, donor, patient, organisation"
                      ],
                      "screenshot": [
                        "https://k9hope.in/cs_hospital.webp",
                        "https://k9hope.in/cs_donor.webp",
                        "https://k9hope.in/cs_patient.webp"
                      ],
                      "softwareVersion": "1.0.0",
                      "datePublished": "2025-01-01",
                      "license": "https://opensource.org/licenses/MIT",
                      "isAccessibleForFree": true,
                      "offers": {
                        "@type": "Offer",
                        "price": "0",
                        "priceCurrency": "INR"
                      },
                      "author": {
                        "@id": "https://k9hope.in/#organization"
                      },
                      "sameAs": [
                        "https://github.com/Rvunveil/k9hope-canine-blood-donation"
                      ]
                    },
                    {
                      "@type": "Organization",
                      "@id": "https://k9hope.in/#organization",
                      "name": "K9Hope — RIT Chennai CSE",
                      "alternateName": "K9Hope Project",
                      "url": "https://k9hope.in",
                      "logo": "https://k9hope.in/k9hope-paw-icon.svg",
                      "email": "k9hope@ritchennai.edu.in",
                      "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Chennai",
                        "addressRegion": "Tamil Nadu",
                        "addressCountry": "IN"
                      },
                      "foundingDate": "2025",
                      "description": "Student research team from RIT Chennai Department of Computer Science & Engineering, in collaboration with Madras Veterinary College, Vepery.",
                      "member": [
                        { "@type": "Person", "name": "Vikram T",      "roleName": "Lead Developer"       },
                        { "@type": "Person", "name": "Prem Kumar",    "roleName": "AI Module"            },
                        { "@type": "Person", "name": "Ram Kishore",   "roleName": "Backend Architecture" },
                        { "@type": "Person", "name": "Pandithurai O", "roleName": "Faculty Mentor"       }
                      ],
                      "sameAs": [
                        "https://github.com/Rvunveil/k9hope-canine-blood-donation"
                      ]
                    },
                    {
                      "@type": "WebSite",
                      "@id": "https://k9hope.in/#website",
                      "url": "https://k9hope.in",
                      "name": "K9Hope",
                      "description": "India's first canine blood donation and management platform",
                      "publisher": { "@id": "https://k9hope.in/#organization" },
                      "inLanguage": "en-IN",
                      "potentialAction": {
                        "@type": "SearchAction",
                        "target": {
                          "@type": "EntryPoint",
                          "urlTemplate": "https://k9hope.in/find-hospital?q={search_term_string}"
                        },
                        "query-input": "required name=search_term_string"
                      }
                    },
                    {
                      "@type": "ResearchProject",
                      "name": "ZICP: Uncertainty-Aware Forecasting in Sparse Veterinary Networks",
                      "description": "Zero-Inflated Conformal Prediction algorithm for canine blood inventory demand forecasting. Achieves 92% empirical coverage with 22% cost reduction over baseline methods.",
                      "url": "https://k9hope.in",
                      "author": [
                        { "@type": "Person", "name": "Pandithurai O" },
                        { "@type": "Person", "name": "Vikram T"      },
                        { "@type": "Person", "name": "Prem Kumar"    },
                        { "@type": "Person", "name": "Ram Kishore"   }
                      ],
                      "funding": {
                        "@type": "Grant",
                        "funder": { "@type": "Organization", "name": "RIT Chennai" }
                      }
                    }
                  ]
                })
              }}
            />
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
