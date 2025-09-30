// Server Component
export const metadata = {
  title: 'Terms of Use | DitonaChat',
  description: 'DitonaChat Terms of Use (18+).'
};
export default function TermsPage() {
  const md = String.raw`TERMS.md
Key Points

Eligibility: You must be at least 18 years old to use DitonaChat. We do not allow minors.
Service Use: This is an 18+ random video chat platform. Respect others, follow our rules, and don't engage in illegal or harmful activities.
Payments: VIP subscriptions via Stripe are auto-renewing; cancel anytime through your account.
Prohibited Conduct: No harassment, exploitation, recording without consent, or illegal content. We enforce rules strictly.
Liability: We provide the service "as is" with no warranties; our liability is limited.
Changes: We may update these Terms; continued use means acceptance.

Terms of Use
Effective Date: September 09, 2025
Version: 1.0
These Terms of Use ("Terms") govern your access to and use of the DitonaChat website (www.ditonachat.com) and related services (collectively, the "Service"), operated by [Company Legal Name] ("we," "us," or "our"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
1. Eligibility
You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you are 18 or older and have the legal capacity to enter into these Terms. We do not knowingly collect information from or provide services to individuals under 18. If we discover a user is under 18, we will terminate their access immediately.
To access the chat feature, you must confirm you are 18+ via our age gate, which sets a cookie (ageok=1). Guests can use basic features without an account, but accounts require sign-in via Google OAuth using NextAuth.
2. Account and Security
You may create an account using Google OAuth for enhanced features like likes, friends lists, and VIP entitlements. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of any unauthorized use.
We reserve the right to suspend or terminate accounts for violations of these Terms.
3. Use of the Service
The Service is an 18+ random video chat platform using WebRTC for peer-to-peer connections. Streams are not recorded by us and are ephemeral.
Features Include:

Quick matching with country and gender filters (VIP unlocks multi-country and multi-gender).
"Prev" match option.
Likes and friends list (view-only).
Text chat (guests limited to 10 messages; VIP unlimited).
Beauty/AR masks (VIP).
Report and abuse tools.

You may use the Service for personal, non-commercial purposes only. You grant us a limited, non-exclusive license to use any data you provide as necessary to operate the Service.
Camera and microphone access is governed by our Permissions-Policy: camera=(self), microphone=(self). Access requires your explicit action and consent.
4. Prohibited Conduct
You agree not to:

Use the Service if you are under 18 or allow minors to use it.
Engage in or promote non-consensual content, exploitation, trafficking, or any illegal activities.
Display or transmit nudity, sexual activity, or explicit content without mutual consent (note: this is an adult service, but all interactions must be consensual).
Harass, bully, threaten, or engage in hate speech, discrimination, or doxxing.
Record, screenshot, or redistribute streams or chats without explicit consent from all parties.
Spam, scam, or impersonate others.
Interfere with the Service, including hacking, viruses, or overloading.
Use automated tools to access or scrape the Service.
Violate any laws, including those related to privacy, obscenity, or intellectual property.

We monitor for safety but do not guarantee detection of all violations.
5. User-Generated Content
You are solely responsible for your content and interactions. We do not produce, host, or record user content. Live streams are peer-to-peer and not stored by us.
If you believe content violates these Terms, use our in-product "Report" feature or contact us at /abuse.
6. Safety and Enforcement
We prioritize user safety. Report violations via the "Report" button or /abuse page. We investigate reports promptly and may issue warnings, suspensions, or permanent bans.
We cooperate with law enforcement as required by law, including for serious violations like child exploitation or threats.
18 U.S.C. § 2257 Compliance: DitonaChat does not produce, host, or distribute recorded adult content. All interactions are live, user-generated, and ephemeral. Users are responsible for ensuring their conduct complies with applicable laws, including age verification for any participants. We do not maintain records under § 2257 as we are not a producer of recorded content. For inquiries, contact our custodian of records at [Contact emails]: info@ditonachat.com.
7. Payments and Subscriptions
VIP features (e.g., multi-filters, "Prev," unlimited text, masks, friends view) are available via Stripe subscriptions (daily, weekly, monthly, yearly).

Billing: Subscriptions auto-renew at the end of each period unless canceled. Access starts immediately upon payment.
Pricing and Taxes: Prices are as displayed on /plans. We add applicable taxes/VAT.
Proration: [Refund Policy specifics] (e.g., no proration for partial periods).
Cancellation: Cancel anytime via the Stripe Customer Portal at /api/stripe/portal. Cancellation takes effect at the end of the current billing period.
Refunds: [Refund Policy specifics] (e.g., no refunds for partial periods; refunds only for technical issues within 7 days).
Chargebacks: Disputed charges may result in account suspension.

For EU/US consumers: You have the right to withdraw from the contract within 14 days (EU) or as per state law (US), but since digital services start immediately, withdrawal may not apply if you've used the Service. Contact us for details.
We do not store full card details; Stripe handles payments securely.
8. Intellectual Property
The Service and its content (excluding user content) are owned by us or our licensors. You may not copy, modify, or distribute them without permission.
For DMCA takedown requests, see /dmca.
9. Termination
We may terminate or suspend your access at any time for violations, without notice. Upon termination, your right to use the Service ends.
10. Disclaimers and Limitation of Liability
The Service is provided "as is" without warranties of any kind, express or implied, including fitness for a particular purpose or non-infringement.
We are not liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service. Our total liability is limited to the amount you paid us in the last 12 months.
The Service may include beta features or be unavailable due to maintenance; we are not liable for interruptions.
11. Governing Law and Dispute Resolution
These Terms are governed by [Governing Law & Venue].
Version with Arbitration (US Users): Disputes shall be resolved by binding arbitration under AAA rules, with no class actions. Venue: [Governing Law & Venue].
Version without Arbitration: Disputes shall be resolved in the courts of [Governing Law & Venue], with no class-action waiver.
12. Changes to Terms
We may update these Terms. Changes are effective upon posting with a new effective date. We'll notify users via email or in-Service notice for material changes. Continued use constitutes acceptance.
13. Miscellaneous
If any provision is invalid, the rest remain in effect. No waiver of any term is a further waiver.
14. Contact Us
For questions: [Contact emails]: info@ditonachat.com, user@ditonachat.com, suggestions@ditonachat.com.
Contracting Entity: [Company Legal Name], [Registered Address].
Change Log

Version 1.0 (September 09, 2025): Initial release.`;
  return (
    <main className="max-w-3xl mx-auto p-6 text-slate-200">
      <h1 className="text-2xl font-semibold mb-4">Terms of Use</h1>
      <article className="whitespace-pre-wrap leading-7">{md}</article>
    </main>
  );
}
