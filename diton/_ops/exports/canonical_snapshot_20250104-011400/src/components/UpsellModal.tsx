"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpsellModalProps {
  onClose: () => void;
}

export default function UpsellModal({ onClose }: UpsellModalProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string>('monthly');

  const plans = [
    { id: 'daily', name: 'Daily', price: '$4.99', duration: '24 hours' },
    { id: 'weekly', name: 'Weekly', price: '$19.99', duration: '7 days' },
    { id: 'monthly', name: 'Monthly', price: '$49.99', duration: '30 days', popular: true },
    { id: 'yearly', name: 'Yearly', price: '$299.99', duration: '365 days', savings: 'Save 50%' }
  ];

  const features = [
    '✅ Unlimited chat messages',
    '✅ HD video quality',
    '✅ Gender & location filters',
    '✅ AR masks & effects',
    '✅ Priority matching',
    '✅ No ads',
    '✅ Translation features',
    '✅ Friend list access'
  ];

  const handleUpgrade = () => {
    router.push(`/api/stripe/subscribe?plan=${selectedPlan}`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full m-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Unlock VIP Access</h2>
              <p className="text-purple-100">Get unlimited features and enhance your experience</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  selectedPlan === plan.id
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                    Popular
                  </span>
                )}
                {plan.savings && (
                  <span className="absolute -top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    {plan.savings}
                  </span>
                )}
                <div className="text-lg font-bold">{plan.name}</div>
                <div className="text-2xl font-bold text-purple-600">{plan.price}</div>
                <div className="text-sm text-gray-600">{plan.duration}</div>
              </button>
            ))}
          </div>

          {/* Features */}
          <div className="mb-6">
            <h3 className="font-bold mb-3">VIP Features:</h3>
            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="text-sm text-gray-700">
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleUpgrade}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            Upgrade to VIP Now
          </button>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center mt-4">
            By upgrading, you agree to our Terms of Service and Privacy Policy.
            Cancel anytime from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
