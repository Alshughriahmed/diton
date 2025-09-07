import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '18 U.S.C. § 2257 Compliance Statement - DitonaChat',
  description: 'Legal compliance statement for adult content platform DitonaChat',
  robots: 'noindex,nofollow'
};

export default function Section2257Page() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">18 U.S.C. § 2257 Compliance Statement</h1>
        
        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Notice</h2>
            <p className="mb-4">
              This website contains material which may be considered adult content. 
              All models, actors, actresses and other persons that appear in any visual 
              depiction of actual sexually explicit conduct appearing or otherwise 
              contained in or at this website were over the age of eighteen years at 
              the time of the creation of such depictions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Age Verification</h2>
            <p className="mb-4">
              DitonaChat requires all users to confirm they are 18 years of age or older 
              before accessing adult content areas of the platform. User-generated content 
              is not pre-screened, and users are responsible for ensuring they comply 
              with all applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
            <p className="mb-4">
              For inquiries related to compliance matters, please contact:
            </p>
            <address className="not-italic">
              <strong>Compliance Officer</strong><br />
              DitonaChat Platform<br />
              Email: <a href="mailto:compliance@ditonachat.com" className="text-blue-400">
                compliance@ditonachat.com
              </a>
            </address>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Platform Responsibility</h2>
            <p className="mb-4">
              DitonaChat operates as a live communication platform. We do not produce, 
              direct, or control user-generated content. Users are solely responsible 
              for their conduct and any content they create or share through the platform.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
