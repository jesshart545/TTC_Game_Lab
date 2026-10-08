import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import "./feature.css";
import "./controls.css";
import "./folders.css";
import "./research.css";
import HelpLink from '../components/HelpLink';

export const metadata: Metadata = {
  title: "TTCGameLab — AI Livestream Creative Studio",
  description: "Create interactive TikTok LIVE experiences with AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<HelpLink/></body>
    </html>
  );
}
