import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://careerpilot.ai'),
  title: {
    default: 'CareerPilot AI — Land your dream job faster with AI',
    template: '%s | CareerPilot AI',
  },
  description: 'AI-powered career operating system: resume optimization, ATS scoring, AI job matching, tailored applications, interview coaching (voice + coding + system design), recruiter CRM, and full pipeline analytics. Powered by GPT-5, Claude Sonnet 4.5, and Gemini 2.5 Pro.',
  keywords: ['AI resume builder', 'ATS resume analyzer', 'job search AI', 'interview coach', 'career copilot', 'resume tailoring', 'cover letter generator', 'recruiter CRM', 'GPT-5 career'],
  authors: [{ name: 'CareerPilot AI' }],
  openGraph: {
    title: 'CareerPilot AI — Land your dream job faster',
    description: 'Optimize resumes, discover jobs, tailor applications, ace interviews. Your always-on AI career copilot.',
    type: 'website',
    siteName: 'CareerPilot AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CareerPilot AI',
    description: 'AI-powered career operating system.',
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/favicon.ico' },
}

export const viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#0b1020' }],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="top-right" richColors closeButton theme="system" />
        </Providers>
      </body>
    </html>
  )
}
