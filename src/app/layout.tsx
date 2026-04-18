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
        
        {/* Botpress Webchat Scripts */}
        <Script 
          src="https://cdn.botpress.cloud/webchat/v2.2/shareable.js" 
          strategy="afterInteractive"
        />
        <Script id="botpress-init" strategy="afterInteractive">
          {`
            window.botpressWebChat.init({
              "botId": "b80a5ea5-563e-40cf-a5fd-d1ec988a529c",
              "clientId": "4c9d9b67-34c2-4f59-8ed6-bfed7d422fcb",
              "hostUrl": "https://cdn.botpress.cloud/webchat/v2.2",
              "messagingUrl": "https://messaging.botpress.cloud",
              "botName": "Badminton Support Assistant",
              "containerWidth": "100%25",
              "layoutWidth": "100%25",
              "hideWidget": false,
              "showCloseButton": true,
              "disableAnimations": false,
              "closeOnEscape": true,
              "showConversationsButton": true,
              "clearConversationOnThemeChange": false,
              "enableTranscriptDownload": false,
              "themeColor": "#2b7b5e"
            });
          `}
        </Script>
      </body>
    </html>
  );
}
