import { useBranding } from "@/context/BrandingContext";
import LegalPage, { legalText } from "./LegalPage";

export default function TermsOfService() {
  const { branding } = useBranding();
  const appName = branding.app_name || "FitWay Hub";

  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      effectiveDate="May 4, 2026"
      contactEmail="legal@fitwayhub.com"
      intro={
        <p style={{ margin: 0 }}>
          These Terms of Service ("Terms") govern your access to and use of <strong style={legalText.strong}>{appName}</strong>
          {" "}— our website, mobile app, and related services (collectively, the "Service"). By creating an account or
          using the Service, you agree to be bound by these Terms. If you don't agree, please don't use the Service.
        </p>
      }
      sections={[
        {
          heading: "Eligibility",
          body: (
            <p style={legalText.p}>
              You must be at least 13 years old (or the minimum digital-consent age in your country, whichever is
              higher) to use the Service. By signing up you confirm that the information you provide is accurate and
              that you are legally able to enter into this agreement.
            </p>
          ),
        },
        {
          heading: "Your Account",
          body: (
            <>
              <p style={legalText.p}>
                You're responsible for everything that happens under your account. Keep your password confidential, use
                a strong unique password, and let us know immediately if you suspect unauthorised access. We may
                suspend or terminate accounts that abuse the Service or violate these Terms.
              </p>
              <p style={legalText.p}>
                Coach accounts have additional requirements: you must provide accurate professional information and
                may be asked to verify your credentials. We may revoke coach status if information is found to be
                false or misleading.
              </p>
            </>
          ),
        },
        {
          heading: "Health &amp; Fitness Disclaimer",
          body: (
            <>
              <p style={legalText.p}>
                <strong style={legalText.strong}>{appName} is not a medical service.</strong> Workouts, nutrition plans,
                analytics, and any guidance provided through the Service are for informational and educational
                purposes only and do not constitute medical advice, diagnosis, or treatment.
              </p>
              <p style={legalText.p}>
                Always consult a qualified healthcare professional before starting a new exercise or diet programme,
                especially if you have a medical condition, are pregnant, or are taking medication. You participate in
                any activity at your own risk.
              </p>
            </>
          ),
        },
        {
          heading: "Subscriptions &amp; Payments",
          body: (
            <>
              <p style={legalText.p}>
                Some features require a paid subscription. Pricing is shown in the app at the time of purchase.
                Subscriptions automatically renew unless you cancel before the end of the current billing period.
              </p>
              <p style={legalText.p}>
                Payments are processed through third-party providers (PayPal, Apple App Store, Google Play, or
                manually-reviewed e-wallet transfers). When you pay through an app store, that store's terms govern
                billing, refunds, and renewals.
              </p>
              <p style={legalText.p}>
                Coaches set their own subscription fees and revenue is shared between the coach and the platform
                according to the published split. If a coach declines or cancels a subscription, we will process a
                refund in line with our refund policy.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable Use",
          body: (
            <>
              <p style={legalText.p}>You agree not to:</p>
              <ul style={legalText.ul}>
                <li style={legalText.li}>Use the Service for any unlawful, harmful, or fraudulent activity.</li>
                <li style={legalText.li}>Upload content that is abusive, hateful, defamatory, sexually explicit, or infringes someone else's rights.</li>
                <li style={legalText.li}>Attempt to gain unauthorised access to other users' accounts or our systems.</li>
                <li style={legalText.li}>Reverse-engineer, decompile, scrape, or otherwise misuse the Service or its underlying APIs.</li>
                <li style={legalText.li}>Interfere with the Service's normal operation, including by introducing malware or sending spam.</li>
                <li style={legalText.li}>Sell, sublicense, or transfer access to your account without our prior written consent.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "User Content",
          body: (
            <p style={legalText.p}>
              You retain ownership of the content you post — workout logs, photos, messages, blog articles, ad
              creatives, and so on ("User Content"). By submitting User Content you grant us a worldwide, non-exclusive,
              royalty-free licence to host, store, reproduce, modify (for formatting/optimisation), and display the
              content as needed to operate the Service. You are responsible for making sure you have the rights to
              everything you upload.
            </p>
          ),
        },
        {
          heading: "Intellectual Property",
          body: (
            <p style={legalText.p}>
              The Service, including its software, design, logos, trademarks, and original content, is owned by
              {" "}{appName} and its licensors and is protected by copyright, trademark, and other laws. Nothing in
              these Terms transfers any of those rights to you.
            </p>
          ),
        },
        {
          heading: "Termination",
          body: (
            <p style={legalText.p}>
              You may close your account at any time from your profile settings. We may suspend or terminate your
              access — with or without notice — if you breach these Terms, present a security risk, or if we are
              required to do so by law. On termination, the licences you grant us under these Terms survive only as
              needed for backups, legal compliance, or aggregated analytics that no longer identify you.
            </p>
          ),
        },
        {
          heading: "Disclaimers",
          body: (
            <p style={legalText.p}>
              The Service is provided "as is" and "as available" without warranties of any kind, whether express or
              implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
              We do not guarantee that the Service will be uninterrupted, error-free, or that any defects will be
              corrected.
            </p>
          ),
        },
        {
          heading: "Limitation of Liability",
          body: (
            <p style={legalText.p}>
              To the maximum extent permitted by law, {appName} and its officers, employees, agents, and partners will
              not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss
              of profits, revenues, data, or goodwill, arising out of or in connection with your use of the Service.
              Our total liability for any claim under these Terms is limited to the amount you paid us in the
              twelve months before the claim arose.
            </p>
          ),
        },
        {
          heading: "Indemnification",
          body: (
            <p style={legalText.p}>
              You agree to defend, indemnify, and hold {appName} harmless from any claims, damages, liabilities, costs,
              or expenses (including reasonable legal fees) arising out of your use of the Service, your User Content,
              or your breach of these Terms.
            </p>
          ),
        },
        {
          heading: "Governing Law",
          body: (
            <p style={legalText.p}>
              These Terms are governed by the laws of the Arab Republic of Egypt, without regard to its conflict-of-laws
              rules. You agree that any dispute arising under these Terms will be resolved exclusively by the competent
              courts of Cairo, Egypt, except where local consumer-protection laws give you the right to bring a claim
              in your country of residence.
            </p>
          ),
        },
        {
          heading: "Changes to These Terms",
          body: (
            <p style={legalText.p}>
              We may revise these Terms from time to time. If a change is material, we will notify you in the app or
              by email at least 14 days before it takes effect. Continued use of the Service after the effective date
              of the new Terms means you accept them.
            </p>
          ),
        },
      ]}
    />
  );
}
