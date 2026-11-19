import Image from "next/image";
import { Laptop, Smartphone } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const appStoreUrl = "https://apps.apple.com/us/app/id6836620328";

export function AppDownloads() {
  const { t } = useLocale();
  const platforms = [
    {
      name: "iPhone",
      icon: Smartphone,
      available: process.env.NEXT_PUBLIC_IPHONE_APP_STORE_LIVE === "1",
      href: appStoreUrl,
      badge: "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg",
      badgeWidth: 120,
      label: "downloadIphoneApp",
    },
    {
      name: "Mac",
      icon: Laptop,
      available: process.env.NEXT_PUBLIC_MAC_APP_STORE_LIVE === "1",
      href: `${appStoreUrl}?platform=mac`,
      badge: "https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-mac-app-store.svg",
      badgeWidth: 156,
      label: "downloadMacApp",
    },
  ] as const;

  return (
    <div className="app-downloads" role="group" aria-label={t("nativeAppDownloads")}>
      {platforms.map(({ name, icon: Icon, available, href, badge, badgeWidth, label }) =>
        available ? (
          <a key={name} className="app-download-link" href={href} aria-label={t(label)}>
            <Image src={badge} alt="" width={badgeWidth} height={40} unoptimized />
          </a>
        ) : (
          <span key={name} className="app-download-pending">
            <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
            <span><strong>{name}</strong><small>{t("appComingSoon")}</small></span>
          </span>
        ),
      )}
    </div>
  );
}
