export const metadata = { title: "Privacy Policy — DitonaChat", description: "How DitonaChat handles your data." };

export default function Privacy(){
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p>We process minimal personal data necessary to operate the service. You must be 18+.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Data We Process</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Technical logs (IP, device, timestamps) for security and abuse prevention.</li>
        <li>Account data if you sign in (email or OAuth profile).</li>
        <li>Payment metadata if you subscribe (handled by a third-party processor).</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Geo & Matching</h2>
      <p>Approximate location may be inferred from headers or your consent via the browser to improve matching. You can deny location permissions.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Retention & Rights</h2>
      <p>Data is retained only as long as necessary. Contact us to request deletion or access.</p>
      <p className="mt-8">Questions: <a className="underline" href="mailto:privacy@ditonachat.com">privacy@ditonachat.com</a></p>
    </main>
  );
}