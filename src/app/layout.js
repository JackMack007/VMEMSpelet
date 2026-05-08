export const metadata = {
  title: 'Hagmans VM Tips',
  description: 'Tävla med dina vänner i VM 2026',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-192x182.png', // Viktig for iOS-ikoner
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Meta-tagger som gjør at appen føles mer som en ekte app på mobil */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1e3a8a" />
      </head>
      <body style={{ margin: 0, backgroundColor: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}