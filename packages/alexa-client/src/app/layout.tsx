import "./globals.css";
import React from "react";

export const metadata = {
  title: "Warrant | Simulated Alexa+ Trust Gateway Client",
  description: "Next.js simulated voice assistant client with out-of-band approval portal and cryptographic audit timeline"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
