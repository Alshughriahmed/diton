import './globals.css'

export const metadata = {
  title: 'DitonaChat',
  description: '18+ video chat platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}