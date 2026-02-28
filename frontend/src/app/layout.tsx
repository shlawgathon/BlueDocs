import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BlueDocs — Spatial Intelligence for the Blue Economy",
  description:
    "Analyze spatial conflicts for offshore wind, aquaculture, and ocean energy projects against real federal regulatory layers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0A1628] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
