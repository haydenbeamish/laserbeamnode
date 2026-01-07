import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Laser Beam Capital - Portfolio Dashboard',
  description: 'Hedge Fund Portfolio Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
