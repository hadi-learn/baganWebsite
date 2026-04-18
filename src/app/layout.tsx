import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bagan Pertandingan — Turnamen Badminton",
  description:
    "Bagan pertandingan turnamen badminton lokal. Lihat jadwal, skor, dan hasil pertandingan secara live.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        
        {/* Botpress Webchat v3 */}
        <Script 
          src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"
          strategy="afterInteractive"
        />
        <Script id="botpress-init" strategy="afterInteractive">
          {`
            (function() {
              var checkBotpress = setInterval(function() {
                if (window.botpress) {
                  clearInterval(checkBotpress);
                  window.botpress.init({
                    "configUrl": "https://files.bpcontent.cloud/2026/04/18/01/20260418012947-O3MRE0GH.json",
                    "hostUrl": "https://cdn.botpress.cloud/webchat/v3.6"
                  });
                }
              }, 100);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
