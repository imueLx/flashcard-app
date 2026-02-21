import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://flashcard-app-g5.vercel.app";
const shareImage = "/logo-with-name/android-chrome-512x512.png";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "BlushCards: Grammar Fun — Grade 5 Subject-Verb Agreement",
  description:
    "BlushCards: Grammar Fun is an interactive flashcard quiz for Grade 5 Subject-Verb Agreement with 40 questions, 3 levels, offline support, and instant feedback.",
  applicationName: "BlushCards: Grammar Fun",
  openGraph: {
    title: "BlushCards: Grammar Fun",
    description:
      "Grade 5 grammar flashcards with instant feedback, stars, levels, and offline support.",
    url: "/",
    siteName: "BlushCards: Grammar Fun",
    type: "website",
    images: [
      {
        url: shareImage,
        width: 512,
        height: 512,
        alt: "BlushCards: Grammar Fun preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlushCards: Grammar Fun",
    description:
      "Grade 5 grammar flashcards with instant feedback, stars, levels, and offline support.",
    images: [shareImage],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BlushCards: Grammar Fun",
    statusBarStyle: "default",
  },
  icons: [
    {
      rel: "icon",
      url: "/icons/favicon-32.png",
      type: "image/png",
      sizes: "32x32",
    },
    {
      rel: "icon",
      url: "/icons/icon-192.png",
      type: "image/png",
      sizes: "192x192",
    },
    {
      rel: "apple-touch-icon",
      url: "/icons/apple-touch-icon.png",
      sizes: "180x180",
    },
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ec4899",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className={`${nunito.className} antialiased`}>
        <Script id="pwa-install-capture" strategy="beforeInteractive">
          {`
            (function () {
              if (typeof window === 'undefined') return;

              var ua = window.navigator.userAgent || '';
              var isMessengerInApp = /FBAN|FBAV|FB_IAB|FB4A|Messenger/i.test(ua);
              var isIOS = /iPhone|iPad|iPod/i.test(ua);
              var isAndroid = /Android/i.test(ua);
              var isStandalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;

              if (isMessengerInApp && !isStandalone) {
                var skipPrompt = false;

                try {
                  skipPrompt = window.sessionStorage.getItem('__external_browser_prompted__') === '1';
                } catch (_) {}

                if (!skipPrompt) {
                  try {
                    window.sessionStorage.setItem('__external_browser_prompted__', '1');
                  } catch (_) {}

                  if (isAndroid) {
                    var shouldOpenChrome = window.confirm(
                      'For best performance and reliable offline mode, open this app in Chrome?'
                    );

                    if (shouldOpenChrome) {
                      var fallbackUrl = window.location.href;
                      var intentUrl =
                        'intent://' +
                        window.location.host +
                        window.location.pathname +
                        window.location.search +
                        window.location.hash +
                        '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
                        encodeURIComponent(fallbackUrl) +
                        ';end';

                      window.location.replace(intentUrl);
                      return;
                    }
                  } else if (isIOS) {
                    window.alert(
                      'For best performance and offline support, open this app in Safari. Tap the menu (•••) in Messenger and choose Open in Browser.'
                    );
                  }
                }
              }

              window.__deferredInstallPrompt = window.__deferredInstallPrompt || null;

              window.addEventListener('beforeinstallprompt', function (event) {
                event.preventDefault();
                window.__deferredInstallPrompt = event;
                window.dispatchEvent(new Event('pwa-install-available'));
              });

              window.addEventListener('appinstalled', function () {
                window.__deferredInstallPrompt = null;
              });

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
