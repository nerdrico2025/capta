import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { OrgProvider } from '@/context/OrgContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'Capta — Recursos Públicos para OSCs',
    template: '%s | Capta',
  },
  description:
    'Encontre editais, leis de incentivo e fundações alinhados com o perfil da sua organização.',
  keywords: ['editais', 'OSC', 'recursos públicos', 'lei rouanet', 'transferegov'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-sans">
        <OrgProvider>
          <QueryProvider>{children}</QueryProvider>
        </OrgProvider>
      </body>
    </html>
  );
}
