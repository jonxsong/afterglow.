import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterglow — Chase the beautiful",
  description: "A little forecast for the most beautiful part of your day.",
  applicationName: "Afterglow",
  openGraph: {
    title: "Afterglow — Chase the beautiful",
    description: "Sunset intelligence for people who appreciate beautiful skies.",
    type: "website",
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

