import type { Metadata } from "next";
import "./globals.css";
import FeedbackChatMount from "./FeedbackChatMount";

export const metadata: Metadata = {
  title: "charge",
  description: "גבייה — charge a person for one thing: makes a Grow payment link (Bit + card) and sends it on WhatsApp from your own number",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}
        <FeedbackChatMount />
</body>
    </html>
  );
}
