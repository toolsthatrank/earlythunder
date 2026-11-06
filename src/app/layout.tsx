import type { Metadata } from "next";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";
import "../../public/workbench-cta.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://earlythunder.com"),
  title: {
    default: "Early Thunder",
    template: "%s | Early Thunder",
  },
  description: "Free research on pre-mainstream opportunities across crypto, deep tech and emerging markets, with sources and dates.",
  keywords: [
    "investment intelligence",
    "asymmetric opportunities",
    "digital assets",
    "crypto research",
    "alternative investments",
  ],
  openGraph: {
    type: "website",
    siteName: "Early Thunder",
    title: "Early Thunder",
    description: "Pre-mainstream token research, sourced and dated.",
    url: "https://earlythunder.com",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Thunder",
    description: "Pre-mainstream opportunity intelligence.",
  },
  // NOTE: no site-wide canonical here. A canonical set in the root layout is
  // inherited by every page that does not override it, which made guides, blog,
  // and listing pages canonicalize to the homepage (Google then treats them as
  // homepage duplicates). Each page sets its own self-canonical instead.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          defer
          data-domain="earlythunder.com"
          src="https://plausible.io/js/script.js"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://earlythunder.com/#website",
              name: "Early Thunder",
              url: "https://earlythunder.com",
              description: "Free research on pre-mainstream opportunities across crypto, deep tech and emerging markets, with sources and dates.",
              // One Organization node for the whole site. It carries the @id that
              // every page-level WebPage node points at with `about`, and it holds
              // the legal name (also the name printed in the footer and on
              // /privacy) together with the brand name it trades under.
              publisher: {
                "@type": "Organization",
                "@id": "https://earlythunder.com/#organization",
                name: "AUTOM8 LLC",
                alternateName: "Early Thunder",
                url: "https://earlythunder.com",
                logo: "https://earlythunder.com/og-default.svg",
                description: "Autonomous intelligence pipeline scanning 154+ protocols for convergence signals, earnings yield, and deadline catalysts. 58 convergence events detected across crypto and emerging markets.",
                contactPoint: {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  url: "https://earlythunder.com/pricing",
                },
                knowsAbout: [
                  "cryptocurrency research",
                  "DeFi protocol analysis",
                  "earnings yield",
                  "protocol revenue and token buybacks",
                  "tokenomics",
                  "airdrop opportunities",
                  "pre-mainstream crypto opportunities",
                  "on-chain analysis",
                ],
              },
              potentialAction: {
                "@type": "SearchAction",
                target: "https://earlythunder.com/opportunities?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className="page">
        <Header />
        <main>{children}</main>
        <Footer />
        <Script src="/roi-measurement.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
