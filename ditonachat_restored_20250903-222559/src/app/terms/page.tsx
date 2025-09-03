// DitonaChat: BEGIN legal-page terms
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-200 mb-4">
              By accessing and using DitonaChat, you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2 className="text-2xl font-semibold mb-4">2. Age Requirement</h2>
            <p className="text-gray-200 mb-4">
              You must be at least 18 years old to use this service. By using DitonaChat, you represent that you are at least 18 years of age.
            </p>

            <h2 className="text-2xl font-semibold mb-4">3. User Conduct</h2>
            <p className="text-gray-200 mb-4">
              Users must treat others with respect and not engage in harassment, bullying, or inappropriate behavior.
            </p>

            <h2 className="text-2xl font-semibold mb-4">4. Privacy and Data</h2>
            <p className="text-gray-200 mb-4">
              Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.
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
  );
}
// DitonaChat: END legal-page terms