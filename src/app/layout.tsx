import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import Script from "next/script";

const AVEstianaFont = localFont({
  src: "../../public/fonts/AVEstiana-Regular.otf",
});

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export const metadata: Metadata = {
  title: "gittomd: Convert GitHub Repositories to a Single Markdown File",
  description:
    "Instantly convert any public GitHub repository into a single, clean Markdown file. Perfect for feeding code to LLMs (GPT-4, Claude), creating docs, and offline analysis.",
    keywords: [
      "github",
      "markdown",
      "gittomd",
      "convert github to markdown",
      "github to markdown",
      "github repository to markdown",  
    ],
    openGraph: {
    title: "gittomd: Your Entire GitHub Repo in One Markdown File",
    description:
      "The perfect tool for feeding codebases to LLMs, creating documentation, or for offline code analysis.",
    url: "https://gittomd.com",
    siteName: "GitToMD",
    images: [
      {
        url: "https://gittomd.com/images/banner_full.png",
        width: 1200,
        height: 628,
        alt: "GitToMD - Convert GitHub repositories to Markdown",
      },
      {
        url: "https://gittomd.com/images/banner_square.png",
        width: 510,
        height: 510,
        alt: "GitToMD - Convert GitHub repositories to Markdown",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitToMD",
    description:
      "Your repository. In Markdown. Instantly. Convert GitHub repositories to Markdown",
    images: ["https://gittomd.com/images/banner_full.png"],
  },
  other: {
    "vk:image": "https://gittomd.com/images/banner_square.png",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL("https://gittomd.com"),
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "gittomd",
  applicationCategory: "DeveloperTool",
  operatingSystem: "Web",
  description:
    "A tool to convert any public GitHub repository into a single, clean Markdown file, optimized for LLMs and documentation.",
  url: "https://gittomd.com",
  author: {
    "@type": "Organization",
    name: "OpenSpace Dev",
    url: "https://t.me/openspaceteam",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${AVEstianaFont.className} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Script
        src={process.env.NEXT_PUBLIC_RYBBIT_SCRIPT_URL}
        data-site-id={process.env.NEXT_PUBLIC_RYBBIT_SITE_ID}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
