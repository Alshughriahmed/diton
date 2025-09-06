// DitonaChat: BEGIN legal-page privacy
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-gray-200 mb-4">
              We collect minimal data necessary for video chat services, including technical data for WebRTC connections and optional user preferences.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Your Rights (GDPR/CCPA)</h2>
            <ul className="text-gray-200 space-y-2">
              <li>• Right to access your personal data</li>
              <li>• Right to rectification of inaccurate data</li>
              <li>• Right to erasure ("right to be forgotten")</li>
              <li>• Right to data portability</li>
              <li>• Right to object to processing</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Data Subject Access Requests (DSAR)</h2>
            <p className="text-gray-200 mb-4">
              To exercise your privacy rights or request data deletion, contact our privacy team:
            </p>
            <div className="bg-black/20 rounded-lg p-4">
              <p className="font-medium">Privacy Team</p>
              <p>Email: <a href="mailto:privacy@ditonachat.com" className="text-blue-400 hover:text-blue-300">privacy@ditonachat.com</a></p>
              <p className="text-sm text-gray-400 mt-2">
                Please include "DSAR Request" in the subject line and provide sufficient information to verify your identity.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
// DitonaChat: END legal-page privacy