import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Hebrew } from "next/font/google";
import "./globals.css";
import FeedbackChatMount from "./FeedbackChatMount";

// One Hebrew sans for the words and its mono sibling for every figure. A page
// whose whole subject is sums and phone numbers reads as made-on-purpose the
// moment the digits get their own voice.
const body = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const figures = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-figures",
  display: "swap",
});

export const metadata: Metadata = {
  title: "גבייה",
  description: "גבייה — charge a person for one thing: makes a Grow payment link (Bit + card) and sends it on WhatsApp from your own number",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The interface is Hebrew, so direction is a property of the app, not of
    // the browser's locale.
    <html lang="he" dir="rtl" className={`${body.variable} ${figures.variable}`}>
      <body>{children}
        <FeedbackChatMount />
</body>
    </html>
  );
}
