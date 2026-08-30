import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { JsonLd } from "@/components/json-ld";
import { localBusinessJsonLd, siteMetadata, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = siteMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1a2332",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="antialiased overflow-x-hidden" suppressHydrationWarning>
        <JsonLd data={[localBusinessJsonLd(), websiteJsonLd()]} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
