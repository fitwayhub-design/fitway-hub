import type { ReactNode } from "react";
import { useEffect } from "react";
import { useBranding } from "@/context/BrandingContext";
import { useI18n } from "@/context/I18nContext";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  kicker: string;
  effectiveDate: string;
  intro: ReactNode;
  sections: LegalSection[];
  contactEmail?: string;
}

/**
 * Shared layout for static legal pages (Privacy Policy, Terms of Service).
 * Uses website tokens (var(--font-heading), accents) so it inherits whatever
 * the admin sets for branding.
 */
export default function LegalPage({ title, kicker, effectiveDate, intro, sections, contactEmail }: LegalPageProps) {
  const { branding } = useBranding();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const appName = branding.app_name || "FitWay Hub";

  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — ${appName}`;
    return () => { document.title = prev; };
  }, [title, appName]);

  return (
    <article
      dir={isAr ? "rtl" : "ltr"}
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "96px 24px 64px",
        fontFamily: "var(--font-en)",
        color: "var(--text-primary)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {kicker}
      </p>

      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "clamp(36px, 6vw, 56px)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "12px 0 8px",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        {isAr ? "آخر تحديث:" : "Last updated:"} <span style={{ fontWeight: 600 }}>{effectiveDate}</span>
      </p>

      <div
        style={{
          marginTop: 32,
          padding: "20px 24px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--text-secondary)",
        }}
      >
        {intro}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 40 }}>
        {sections.map((s, i) => (
          <section key={i}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
                paddingBottom: 8,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {`${i + 1}. ${s.heading}`}
            </h2>
            <div
              style={{
                marginTop: 14,
                fontSize: 15,
                lineHeight: 1.75,
                color: "var(--text-secondary)",
              }}
            >
              {s.body}
            </div>
          </section>
        ))}
      </div>

      {contactEmail && (
        <div
          style={{
            marginTop: 48,
            padding: "20px 24px",
            border: "1px solid var(--border)",
            borderRadius: 16,
            fontSize: 14,
            color: "var(--text-secondary)",
          }}
        >
          {isAr
            ? <>للأسئلة بشأن هذه الوثيقة، تواصل معنا على </>
            : <>For questions about this document, reach us at </>}
          <a href={`mailto:${contactEmail}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{contactEmail}</a>
          .
        </div>
      )}
    </article>
  );
}

/* Re-usable inline styles for content authors. */
export const legalText = {
  p: { margin: "0 0 12px" } as const,
  ul: { margin: "0 0 12px", paddingInlineStart: 22 } as const,
  li: { marginBottom: 6 } as const,
  strong: { color: "var(--text-primary)", fontWeight: 700 } as const,
};
