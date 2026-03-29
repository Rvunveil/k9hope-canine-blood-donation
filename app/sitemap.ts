import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://k9hope.in'
  const now = new Date()
  return [
    { url: base,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/register`,      lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/login`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/onboarding`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
