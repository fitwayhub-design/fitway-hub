import { ReactNode } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useTheme } from "@/context/ThemeContext";

/**
 * Antd theme bridge — themes the handful of admin/coach "ads" pages that still
 * use Ant Design to the FitWay tokens (dark-first, yellow primary, 12px radius,
 * no heavy shadows) so they match the redesigned panels.
 *
 * PERFORMANCE: this module is the ONLY place outside the ads pages that imports
 * antd. It is loaded lazily (React.lazy in App.tsx) and wraps just the ads
 * routes, so the ~350 kB gzip antd vendor chunk stays out of the entry bundle
 * and is fetched only when an ads page is actually opened.
 */
export default function AntdScope({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#FFD600",
          colorLink: "#3B8BFF",
          colorInfo: "#3B8BFF",
          borderRadius: 12,
          fontFamily: "var(--font-en)",
          colorBgBase: isDark ? "#0a0a0a" : "#f8f8f8",
        },
        components: {
          Button: { primaryColor: "#0a0a0a", primaryShadow: "none", defaultShadow: "none", dangerShadow: "none" },
          Card: { borderRadiusLG: 16 },
          Modal: { borderRadiusLG: 16 },
          Table: { headerBg: "transparent", borderColor: "transparent" },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
