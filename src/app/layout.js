export const metadata = {
  title: 'VM 2026 Tipping',
  description: 'Internkonkurranse for fotball-VM 2026',
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <head>
        {/* Dette sikrer at vi kan bruke moderne CSS-oppsett */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, backgroundColor: '#f9fafb' }}>
        {children}
      </body>
    </html>
  );
}