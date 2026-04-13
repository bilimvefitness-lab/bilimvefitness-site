import Link from "next/link";
import type { ReactNode } from "react";

import { HeaderCommand } from "@/components/layout/header-command";
import { siteNavigation } from "@/content/navigation";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/10 bg-shell/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="font-display text-lg tracking-[0.08em] text-ink">
            Bilim ve Fitness
          </Link>
          <div className="flex items-center gap-3">
            <nav aria-label="Ana navigasyon" className="hidden gap-6 text-sm text-ink/72 md:flex">
              {siteNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-ink">
                  {item.label}
                </Link>
              ))}
            </nav>
            <HeaderCommand />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="section-rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-ink/64 lg:px-10">
          <p className="max-w-2xl">
            Bilim ve Fitness; bilimsel netlik, sistem dusuncesi ve premium sadelik uzerine
            kurulu bir fitness ekosistemi icin dijital merkez olarak tasarlanmistir.
          </p>
          <div className="flex flex-wrap gap-4">
            {siteNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
