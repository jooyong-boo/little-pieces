import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Little Pieces',
  description: 'Couple memory map service scaffold',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
