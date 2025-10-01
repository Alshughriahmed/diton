// DitonaChat: BEGIN legal-page privacy
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ditonachat.com';

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "PrivacyPolicy",
        "name": "Privacy Policy",
        "url": `${ORIGIN}/privacy`
      }} />
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-gray-200 mb-4">
              We collect information you provide directly to us, such as when you create an account or use our chat features.
            </p>
          </div>

          <div className="flex justify-center">
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors">
              Back to Home
            </Link>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
// DitonaChat: END legal-page privacy