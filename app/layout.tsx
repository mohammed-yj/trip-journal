import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og-travel-city.png", base).toString();

  return {
    metadataBase: base,
    title: {
      default: "观迹 · 旅行与城市观察档案",
      template: "%s · 观迹",
    },
    description:
      "移动端优先的私人 Travel & City Log：记录旅行、城市街景、建筑、自然与博物馆展览，整理照片与观察笔记，并随时导出。",
    applicationName: "观迹",
    robots: { index: false, follow: false },
    openGraph: {
      title: "观迹 · 旅行与城市观察档案",
      description: "旅行、城市与博物馆的一切所见，现场十秒开始记录，回家后慢慢整理。默认完全私有。",
      type: "website",
      locale: "zh_CN",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "观迹 · Travel & City Log" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "观迹 · Travel & City Log",
      description: "我的旅行与城市观察档案",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
