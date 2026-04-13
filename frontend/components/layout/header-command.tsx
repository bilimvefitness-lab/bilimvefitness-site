"use client";

import { usePathname } from "next/navigation";

import { CommandButton } from "@/components/ui/command-button";

export function HeaderCommand() {
  const pathname = usePathname();
  const isArticle = pathname.startsWith("/yazilar/");
  const hide =
    pathname === "/test" ||
    pathname === "/kitap" ||
    pathname === "/uygulama" ||
    pathname === "/yazilar" ||
    pathname === "/_not-found" ||
    isArticle;

  if (hide) {
    return null;
  }

  return (
    <div className="hidden md:block">
      <CommandButton href="/test">Teste Gir</CommandButton>
    </div>
  );
}
