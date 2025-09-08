// Server Component
export const metadata = {
  title: 'Privacy Policy | DitonaChat',
  description: 'DitonaChat Privacy Policy (no recording of streams).'
};
export default function PrivacyPage() {
  const md = String.raw`PRIVACY.md
Key Points

Data We Collect: Account info, IP/geo, device data, chat metadata; no recording of video streams.
Use and Sharing: For service delivery, safety, payments; shared with processors like Stripe, Google.
Your Rights: Access, delete, or object to your data; EU GDPR and US CCPA compliant.
Retention: Data kept only as needed (e.g., security logs 12-18 months).
Security: We use TLS and best practices to protect data.
No Selling: We do not sell your personal data; opt-out mechanisms provided.

Privacy Policy
Effective Date: September 09, 2025
Version: 1.0
This Privacy Policy explains how [Company Legal Name] ("we," "us," or "our") collects, uses, shares, and protects your personal information when you use DitonaChat (www.ditonachat.com) and related services (the "Service"). We are committed to protecting your privacy in compliance with GDPR, ePrivacy Directive (EU), CCPA/CPRA (US), and other applicable laws.
1. Information We Collect
Account Identifiers (Google email), Session/Technical data (IP, geo, device), Usage data (filters, likes/friends metadata), Payment metadata (Stripe). We do not record audio/video streams.
2. How We Use Your Information
Authentication and accounts, matching/service delivery, safety/abuse prevention, payments/entitlements, fraud detection, performance monitoring. Consent for precise geolocation.
3. Sharing Your Information
Processors: Vercel, Stripe, Google, hCaptcha (if enabled), TURN/ICE relays. Lawful requests as required. No “sale” under CCPA/CPRA.
International transfers with SCCs where applicable.
4. Retention
Account data: until deletion + 30d. Security logs: 12–18m. Payment metadata: 7y. Ephemeral chats/streams: not retained.
5. Your Rights
GDPR/CCPA rights (access, delete, object, portability, etc.). Email info@ditonachat.com. We respond within 30–45 days.
6. Cookies and Trackers
Minimal cookies:
- ageok: age confirmation (session)
- session/JWT: authentication (session)
No analytics yet; browser translation allowed.
7. Security
TLS, least-privilege, breach notifications as required.
8. Children’s Privacy
18+ only. If we learn of under-18 data, we delete it.
9. Changes
We may update this Policy; continued use = acceptance.
10. Contact
info@ditonachat.com. Data Controller: [Company Legal Name], [Registered Address].`;
  return (
    <main className="max-w-3xl mx-auto p-6 text-slate-200">
      <h1 className="text-2xl font-semibold mb-4">Privacy Policy</h1>
      <article className="whitespace-pre-wrap leading-7">{md}</article>
    </main>
  );
}
