import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatSpin — Random Video Chat",
  description: "Connect instantly with random people around the world via high-quality video chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
