import type { ReactNode } from "react";
import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { buildMetadata } from "@/lib/metadata";
import { organizationSchema, websiteSchema } from "@/lib/schema";
import "@/styles/globals.css";

export const metadata: Metadata = buildMetadata({
  title: "Bilimsel Fitness Ekosistemi",
  description:
    "Bilim ve Fitness; bilimsel netlik, test, sistem, yazi, kitap ve uygulama katmanlariyla kurulan premium fitness ekosistemidir.",
  path: "/",
  keywords: [
    "bilimsel fitness",
    "fitness sistemi",
    "fitness testi",
    "antrenman bilimi",
    "toparlanma",
    "sureklilik",
  ],
  category: "fitness",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const schema = [organizationSchema(), websiteSchema()];

  return (
    <html lang="tr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
