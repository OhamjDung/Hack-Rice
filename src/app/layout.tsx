import type { Metadata } from 'next';
import './globals.css';
import './game.css';
export const metadata: Metadata = { title: 'RoomEconomy — Make a living. Build a life.', description: 'Your budget becomes your world. An interactive financial survival game.' };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="en"><body>{children}</body></html>; }
