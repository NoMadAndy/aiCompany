import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Company',
  description: 'Selbst-evolvierende KI-Plattform - Deine virtuelle Firma',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen bg-[var(--bg-primary)]">
        {children}
      </body>
    </html>
  )
}
