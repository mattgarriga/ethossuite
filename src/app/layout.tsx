import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EthosSuite",
  description: "Tools from Ethos Business Solutions for NetSuite teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
            <Link href="/" aria-label="EthosSuite home" className="flex items-center gap-3">
              <Image
                src="/ethos-logo.webp"
                alt="Ethos Business Solutions"
                width={2000}
                height={1375}
                className="h-14 w-auto"
                priority
              />
            </Link>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-neutral-600">
            &copy; Ethos Business Solutions
          </div>
        </footer>
      </body>
    </html>
  );
}
