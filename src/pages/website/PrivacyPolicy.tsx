import { useBranding } from "@/context/BrandingContext";
import LegalPage, { legalText } from "./LegalPage";

export default function PrivacyPolicy() {
  const { branding } = useBranding();
  const appName = branding.app_name || "FitWay Hub";

  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      effectiveDate="May 4, 2026"
      contactEmail="privacy@fitwayhub.com"
      intro={
        <p style={{ margin: 0 }}>
          Your privacy matters to us at <strong style={legalText.strong}>{appName}</strong>. This Privacy Policy
          explains what information we collect, how we use it, and the choices you have. By creating an account or
          using the platform, you agree to the practices described below.
        </p>
      }
      sections={[
        {
          heading: "Information We Collect",
          body: (
            <>
              <p style={legalText.p}>
                We collect the minimum information needed to operate the service and improve your experience.
                This falls into three categories:
              </p>
              <ul style={legalText.ul}>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>Account data</strong>: name, email address, password (hashed),
                  role (athlete, coach, admin), and a security question/answer used for password recovery.
                </li>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>Profile &amp; fitness data</strong>: gender, date of birth, height,
                  weight, fitness goal, activity level, daily step goal, target weight, medical history (if you
                  choose to share it), workout sessions, completed plans, and progress photos you upload.
                </li>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>Device &amp; usage data</strong>: device type, operating system,
                  IP address, approximate location (only if you grant permission), push-notification token, and
                  basic interaction logs that help us debug issues and detect abuse.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "How We Use Your Information",
          body: (
            <>
              <p style={legalText.p}>We use the data we collect to:</p>
              <ul style={legalText.ul}>
                <li style={legalText.li}>Provide and personalise the service — workouts, nutrition plans, coaching matches, analytics, and notifications.</li>
                <li style={legalText.li}>Process payments and subscriptions through trusted providers (PayPal, in-app purchases, manual e-wallet review).</li>
                <li style={legalText.li}>Communicate with you — onboarding messages, plan updates, security alerts, and product announcements you've opted into.</li>
                <li style={legalText.li}>Keep the platform safe — detecting fraud, enforcing our Terms, and complying with legal obligations.</li>
                <li style={legalText.li}>Improve the product — measuring engagement, fixing bugs, and prioritising new features.</li>
              </ul>
              <p style={legalText.p}>We do not sell your personal data.</p>
            </>
          ),
        },
        {
          heading: "Sharing &amp; Disclosure",
          body: (
            <>
              <p style={legalText.p}>We share information only where it is necessary to deliver the service:</p>
              <ul style={legalText.ul}>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>With your coach</strong>: when you subscribe to a coach, your relevant
                  fitness data and messages are visible to that coach.
                </li>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>With service providers</strong>: cloud hosting, database, file storage,
                  payment processors, push-notification gateways, and email delivery — bound by confidentiality terms.
                </li>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>With authorities</strong>: if required by law, court order, or to
                  protect the rights, property, or safety of our users or the public.
                </li>
                <li style={legalText.li}>
                  <strong style={legalText.strong}>In a business transfer</strong>: if {appName} is acquired or merged,
                  user data may transfer to the new owner under the same protections.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Cookies &amp; Local Storage",
          body: (
            <p style={legalText.p}>
              We use browser local storage and a small number of essential cookies to keep you signed in, remember
              your language and theme preferences, and store cached branding so the app loads quickly. We do not use
              third-party advertising cookies.
            </p>
          ),
        },
        {
          heading: "Data Retention",
          body: (
            <p style={legalText.p}>
              We keep your data only as long as your account is active or as needed to provide the service. You can
              request deletion of your account at any time; once we receive that request we delete your personal data
              within 30 days, except where retention is required by law (for example, financial records).
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p style={legalText.p}>
              Passwords are hashed with bcrypt. Connections are encrypted in transit (HTTPS/TLS). We restrict
              administrative access on a least-privilege basis and review our infrastructure regularly. No system is
              perfectly secure, but we work to maintain industry-standard safeguards.
            </p>
          ),
        },
        {
          heading: "Your Rights",
          body: (
            <>
              <p style={legalText.p}>Depending on where you live, you may have the right to:</p>
              <ul style={legalText.ul}>
                <li style={legalText.li}>Access the personal data we hold about you.</li>
                <li style={legalText.li}>Correct inaccurate or incomplete data.</li>
                <li style={legalText.li}>Delete your data ("right to be forgotten").</li>
                <li style={legalText.li}>Export your data in a machine-readable format.</li>
                <li style={legalText.li}>Object to or restrict certain processing.</li>
                <li style={legalText.li}>Withdraw consent at any time without affecting prior lawful processing.</li>
              </ul>
              <p style={legalText.p}>To exercise these rights, contact us using the details at the bottom of this page.</p>
            </>
          ),
        },
        {
          heading: "Children's Privacy",
          body: (
            <p style={legalText.p}>
              {appName} is not intended for children under 13 (or under 16 where local law requires). We do not
              knowingly collect data from children. If you believe a child has provided us with personal information,
              please contact us so we can remove it.
            </p>
          ),
        },
        {
          heading: "International Transfers",
          body: (
            <p style={legalText.p}>
              Your information may be processed in countries other than your own, including by service providers
              based outside Egypt. Where applicable, we rely on standard contractual clauses or other lawful
              transfer mechanisms to keep your data protected.
            </p>
          ),
        },
        {
          heading: "Changes to This Policy",
          body: (
            <p style={legalText.p}>
              We may update this Privacy Policy from time to time. When we make material changes we'll notify you in
              the app or by email and update the "Last updated" date at the top of this page.
            </p>
          ),
        },
      ]}
    />
  );
}
