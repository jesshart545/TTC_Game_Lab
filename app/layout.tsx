import type { Metadata } from "next";
import "./globals.css";
import "./feature.css";
import HelpContact from "../components/HelpContact";

export const metadata: Metadata = {
  title: "TTCGameLab — AI Livestream Creative Studio",
  description: "Create interactive TikTok LIVE experiences with AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<HelpContact /></body>
    </html>
  );
}
