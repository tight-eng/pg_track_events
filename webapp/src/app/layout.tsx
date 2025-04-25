import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PrimaryNav } from "@/components/navigation/primary-nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tight Analytics",
  description: "Product Analytics Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white">
      <body className={inter.className}>
        <div className="flex h-screen">
          <PrimaryNav />
          <main className="flex-1 overflow-hidden bg-white">{children}</main>
        </div>
      </body>
    </html>
  );
}
