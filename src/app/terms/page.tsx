export const metadata = { title: "Terms of Use — DitonaChat", description: "Basic terms for using DitonaChat." };

export default function Terms(){
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Terms of Use</h1>
      <p>By accessing or using DitonaChat, you agree to these Terms. You must be 18+ to use this service.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Acceptable Use</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>No illegal content or behavior.</li>
        <li>No harassment, hate speech, or exploitation.</li>
        <li>Respect privacy. Do not share others' personal data without consent.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Accounts & Subscriptions</h2>
      <p>Some features require an account or paid plan. Billing is handled by our payment processor. Refunds are evaluated case-by-case.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Disclaimer</h2>
      <p>Service is provided "as-is" without warranties. We may suspend or terminate access for policy violations.</p>
      <p className="mt-8">For questions: <a className="underline" href="mailto:info@ditonachat.com">info@ditonachat.com</a></p>
    </main>
  );
}