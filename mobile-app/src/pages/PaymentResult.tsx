import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { useI18n } from "@/context/I18nContext";

type PaymentResultType = "success" | "cancel" | "error";

interface PaymentResultProps {
  result: PaymentResultType;
}

const resultConfig: Record<
  PaymentResultType,
  { titleKey: string; descKey: string; ctaKey: string; ctaHref: string }
> = {
  success: {
    titleKey: "payment_success_title",
    descKey: "payment_success_desc",
    ctaKey: "payment_success_cta",
    ctaHref: "/app/dashboard",
  },
  cancel: {
    titleKey: "payment_cancel_title",
    descKey: "payment_cancel_desc",
    ctaKey: "payment_cancel_cta",
    ctaHref: "/app/pricing",
  },
  error: {
    titleKey: "payment_error_title",
    descKey: "payment_error_desc",
    ctaKey: "payment_error_cta",
    ctaHref: "/app/pricing",
  },
};

export default function PaymentResult({ result }: PaymentResultProps) {
  const { t } = useI18n();
  const { titleKey, descKey, ctaKey, ctaHref } = resultConfig[result];

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>{t(titleKey)}</h1>
        <p style={styles.description}>{t(descKey)}</p>
        <Link to={ctaHref} style={styles.button}>
          {t(ctaKey)}
        </Link>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    borderRadius: "var(--radius-full)",
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
    padding: "28px",
    textAlign: "center",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "28px",
    color: "#0f172a",
  },
  description: {
    margin: "0 0 24px",
    lineHeight: 1.6,
    color: "#334155",
  },
  button: {
    display: "inline-block",
    textDecoration: "none",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "10px 18px",
    borderRadius: "var(--radius-full)",
    fontWeight: 600,
  },
};
