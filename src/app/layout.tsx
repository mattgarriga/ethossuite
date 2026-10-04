import type { Metadata } from "next";
import { Sora, Ubuntu } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sora", display: "swap" });
const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ubuntu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EthosSuite",
  description: "Tools from Ethos Business Solutions for NetSuite teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${ubuntu.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <header className="header-band">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" aria-label="EthosSuite home" className="flex min-w-0 items-center gap-3">
              <span className="flex shrink-0 rounded-card bg-white p-1.5">
                <Image
                  src="/ethos-logo.webp"
                  alt="Ethos Business Solutions"
                  width={2000}
                  height={1375}
                  className="h-[42px] w-auto"
                  priority
                />
              </span>
              <span className="font-display text-lg font-bold text-white sm:text-xl">EthosSuite</span>
            </Link>
            <UserMenu />
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line bg-card">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-mute sm:px-6">
            <span>&copy; Ethos Business Solutions</span>
            <span className="font-display font-semibold text-navy2">EthosSuite</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
