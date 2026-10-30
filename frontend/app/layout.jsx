import './globals.css';
import { AppProvider } from '../components/AppContext';

export const metadata = {
  title: 'Mediast — Real-Time COD Tracking Dashboard',
  description: 'Enterprise Cash-On-Delivery order tracking, confirmer analytics, marketing expenses, and profit management.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0d14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}


