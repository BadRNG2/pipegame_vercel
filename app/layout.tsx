import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: "Marcos Pires — Pipe Game", template: "%s | Marcos Pires" },
  description:
    "Interactive pipe puzzle used in the portfolio of Marcos Pires — slide tiles to route water from faucet to goal.",
  keywords: ["Marcos Pires", "pipe game", "puzzle", "portfolio", "React", "Next.js"],
  authors: [{ name: "Marcos Pires", url: "https://marcospires.dev" }],
  openGraph: {
    title: "Marcos Pires — Pipe Game",
    description:
      "Interactive pipe puzzle used in the portfolio of Marcos Pires — slide tiles to route water from faucet to goal.",
    url: "https://marcospires.dev",
    siteName: "Marcos Pires Portfolio",
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Marcos Pires — Pipe Game',
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#06b6d4" />
        <link rel="icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
