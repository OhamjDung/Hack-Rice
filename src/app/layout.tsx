import type { Metadata } from 'next';
import './globals.css';
import './game.css';
export const metadata: Metadata = { title: 'CashBound — Make a living. Build a life.', description: 'Your budget becomes your world. An interactive financial survival game.', icons: { icon: '/room-economy-mark.svg' } };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="en"><body>{children}</body></html>; }
