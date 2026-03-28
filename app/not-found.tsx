import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found | K9Hope',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <main style={{ textAlign: 'center', padding: '4rem' }}>
      <h1>404 — Page Not Found</h1>
      <p>The page you are looking for doesn&apos;t exist on K9Hope.</p>
      <a href="/">← Back to K9Hope Home</a>
    </main>
  )
}
