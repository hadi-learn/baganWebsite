import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
