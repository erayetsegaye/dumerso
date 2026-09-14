import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Inter, Dancing_Script } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const script = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DUMERSO COFFEE - Freshly brewed. Made with care.',
  description: 'Explore our digital menu of hot drinks, tea, espresso, macchiato, and bottled water at Dumerso Coffee, Gombora Taxi Mazoriya.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${script.variable}`}
    >
      <body className="font-sans bg-[#1A0D07] text-[#F3E4CB] antialiased selection:bg-[#8B5A2B] selection:text-white">
        {children}
      </body>
    </html>
  );
}
