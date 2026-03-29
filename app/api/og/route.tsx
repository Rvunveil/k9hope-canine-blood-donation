import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: 'white',
          padding: '60px',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, marginBottom: 16, display: 'flex' }}>
          🐾 K9Hope
        </div>
        <div style={{ fontSize: 32, fontWeight: 600, marginBottom: 24, textAlign: 'center', display: 'flex' }}>
          India's Canine Blood Donation Network
        </div>
        <div style={{ fontSize: 22, opacity: 0.9, textAlign: 'center', maxWidth: 800, display: 'flex' }}>
          AI-powered DEA blood type matching · DAHD 2025 compliant · Open Source
        </div>
        <div style={{ marginTop: 40, fontSize: 20, opacity: 0.75, display: 'flex' }}>
          k9hope.in · RIT Chennai × Madras Veterinary College
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
