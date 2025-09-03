// DitonaChat: BEGIN legal-page abuse
import Link from 'next/link';

export default function AbusePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Abuse Prevention</h1>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Zero Tolerance Policy</h2>
            <p className="text-gray-200 mb-4">
              DitonaChat has zero tolerance for abuse, harassment, or any form of harmful behavior toward other users.
            </p>

            <h2 className="text-2xl font-semibold mb-4">2. Reporting Abuse</h2>
            <p className="text-gray-200 mb-4">
              If you experience or witness abusive behavior, please report it immediately using our reporting tools.
            </p>

            <h2 className="text-2xl font-semibold mb-4">3. Investigation Process</h2>
            <p className="text-gray-200 mb-4">
              All reports are taken seriously and investigated promptly by our safety team.
            </p>

            <h2 className="text-2xl font-semibold mb-4">4. Support Resources</h2>
            <p className="text-gray-200 mb-4">
              We provide support resources and assistance for users who have experienced abuse on our platform.
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
// DitonaChat: END legal-page abuse