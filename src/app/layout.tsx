import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppProvider";

export const metadata: Metadata = {
  title: "Contri: your ajo, without the alajo",
  description: "Save with people you trust. Everyone puts in, one person collects each round, and nobody holds the money. Built on Monad.",
  openGraph: {
    title: "Contri",
    description: "Your ajo, without the alajo. Everyone puts in, one person collects each round, and nobody holds the money.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f2a6b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
