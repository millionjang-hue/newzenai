import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NewZen CRM",
    template: "%s · NewZen CRM",
  },
  description: "리드 관리, 세일즈 파이프라인, 매출 분석을 한곳에서 처리하는 CRM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          // Applies the stored theme before first paint so the UI never flashes.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('crm-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
