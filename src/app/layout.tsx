import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fun Flashcards",
  description: "Learn and play with fun flashcard quizzes!",
  applicationName: "Fun Flashcards",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fun Flashcards",
    statusBarStyle: "default",
  },
  icons: [
    { rel: "icon", url: "/icon-192.png", type: "image/png" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ec4899",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
