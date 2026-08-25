import type { Metadata } from "next";
import { Great_Vibes, Source_Serif_4, Work_Sans } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Script face used by the design editor canvas (e.g. "Celebrating") — loaded
// site-wide so /proof-render renders it identically to /design when
// Puppeteer screenshots it for the print proof.
const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "The Funeral Stationery | You design the tribute. We print the memories.",
  description:
    "Personalise a tribute booklet in minutes, delivered next day. Fast turnaround for your most precious tributes, delivered with compassionate professionalism.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${workSans.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
        {children}
      </body>
    </html>
  );
}
