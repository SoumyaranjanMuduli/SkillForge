import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SkillForge — Analytics Assessment Platform',
  description: 'Practice SQL, Excel, Python, Data Engineering and analytics assessments with admin review and timed attempts.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
