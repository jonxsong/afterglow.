import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const title = "Afterglow — View the golden hour";
const description = "See tonight’s predicted sunset colors and the best local time to watch.";
const imageAlt = "Afterglow’s View the golden hour card with an illustrated sunset sky and forecast timeline.";
const canonicalUrl = new URL("/", SITE_URL);

export const metadata: Metadata = {
  metadataBase: canonicalUrl,
  title,
  description,
  applicationName: "Afterglow",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Afterglow",
    url: canonicalUrl,
    images: [{
      url: new URL("/social/afterglow-og.png", canonicalUrl),
      type: "image/png",
      width: 1200,
      height: 630,
      alt: imageAlt,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{
      url: new URL("/social/afterglow-x.png", canonicalUrl),
      alt: imageAlt,
    }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

