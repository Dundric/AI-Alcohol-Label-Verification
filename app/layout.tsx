import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Alcohol Label Verification",
  description: "AI-powered alcohol label verification system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-blue-600 text-white shadow-lg" role="navigation" aria-label="Main navigation">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold hover:text-blue-100 transition-colors">
                🍷 Label Verification
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/"
                  className="hover:text-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded px-2 py-1"
                  aria-label="Go to home page"
                >
                  Instructions
                </Link>
                <Link
                  href="/upload"
                  className="hover:text-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded px-2 py-1"
                  aria-label="Go to upload page"
                >
                  Upload
                </Link>
                <Link
                  href="/review"
                  className="hover:text-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded px-2 py-1"
                  aria-label="Go to review page"
                >
                  Review
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8" role="main">
          {children}
        </main>
      </body>
    </html>
  );
}
