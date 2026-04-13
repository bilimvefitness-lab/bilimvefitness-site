export type NavigationItem = {
  href: string;
  label: string;
};

export const siteNavigation: NavigationItem[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/sistem", label: "Sistem" },
  { href: "/test", label: "Test" },
  { href: "/yazilar", label: "Yazilar" },
  { href: "/kitap", label: "Kitap" },
  { href: "/uygulama", label: "Uygulama" },
];
