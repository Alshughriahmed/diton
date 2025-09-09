"use client";

import { useState, useEffect } from "react";
import { on } from "@/utils/events";
import type { Plan } from "@/lib/plans";

interface UpsellModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const featureMessages = {
  gender: {
    title: "🔒 فلترة الجنس",
    description: "اختر الجنس المفضل للمطابقات (حتى 2 خيارات)",
    benefits: ["فلترة دقيقة حسب التفضيلات", "مطابقات أفضل", "توفير الوقت"]
  },
  countries: {
    title: "🌍 فلترة الدول", 
    description: "اختر الدول المفضلة للمطابقات (حتى 15 دولة)",
    benefits: ["مطابقات من دول محددة", "تجربة ثقافية متنوعة", "لغات مختلفة"]
  },
  beauty: {
    title: "✨ مرشح التجميل",
    description: "تحسين مظهرك بتقنية الذكي الاصطناعي",
    benefits: ["نعومة البشرة", "إضاءة طبيعية", "مظهر أفضل"]
  },
  masks: {
    title: "🤡 الأقنعة والفلاتر",
    description: "أقنعة وفلاتر متقدمة للمرح والخصوصية",
    benefits: ["أقنعة ثلاثية الأبعاد", "فلاتر متنوعة", "خصوصية إضافية"]
  },
  friends: {
    title: "👥 نظام الأصدقاء",
    description: "احفظ المطابقات المفضلة وتواصل معهم لاحقاً",
    benefits: ["حفظ المطابقات", "قائمة أصدقاء", "محادثات خاصة"]
  },
  default: {
    title: "🌟 ميزات VIP حصرية",
    description: "استمتع بجميع الميزات المتقدمة لتجربة أفضل",
    benefits: ["فلترة متقدمة", "مرشحات جمال", "أولوية في المطابقات"]
  }
};

export default function UpsellModal({ isOpen: externalOpen, onClose }: UpsellModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<string>("default");
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    // Fetch plans on component mount
    fetch('/api/stripe/prices')
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .catch(() => setPlans([]));

    const offUpsell = on("ui:upsell", (featureType) => {
      setFeature(featureType || "default");
      setIsOpen(true);
    });

    return () => {
      offUpsell();
    };
  }, []);

  useEffect(() => {
    if (externalOpen !== undefined) {
      setIsOpen(externalOpen);
    }
  }, [externalOpen]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const currentFeature = featureMessages[feature as keyof typeof featureMessages] || featureMessages.default;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" 
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <div className="bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900 rounded-2xl border border-purple-500/30 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="relative p-6 text-center">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            <div className="text-4xl mb-2">👑</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              ترقية إلى VIP
            </h2>
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-3 py-1 rounded-full text-sm font-bold inline-block">
              PREMIUM
            </div>
          </div>

          {/* Feature Content */}
          <div className="px-6 pb-4">
            <div className="bg-black/30 rounded-xl p-4 mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">
                {currentFeature.title}
              </h3>
              <p className="text-gray-300 text-sm mb-3">
                {currentFeature.description}
              </p>
              
              <div className="space-y-2">
                {currentFeature.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-200">
                    <span className="text-green-400">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All Plans */}
            <div className="space-y-3 mb-4">
              {plans.map((plan) => (
                <form key={plan.id} action="/api/stripe/subscribe" method="POST" className="block">
                  <input type="hidden" name="priceId" value={plan.priceId ?? plan.id} />
                  <button 
                    type="submit"
                    className="w-full bg-white/10 hover:bg-white/20 rounded-xl p-4 text-left transition-all border border-white/20 hover:border-purple-400"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{plan.nickname}</div>
                        <div className="text-sm text-gray-300">
                          ${(plan.amount / 100).toFixed(2)} / {plan.interval === 'day' ? 'يوم' : plan.interval === 'week' ? 'أسبوع' : plan.interval === 'month' ? 'شهر' : 'سنة'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-400 font-bold text-lg">
                          ${(plan.amount / 100).toFixed(2)}
                        </div>
                        {plan.interval === 'yearly' && (
                          <div className="text-green-400 text-xs">أفضل قيمة!</div>
                        )}
                      </div>
                    </div>
                  </button>
                </form>
              ))}
            </div>

            {/* Fallback if no plans */}
            {plans.length === 0 && (
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <div className="text-center">
                  <div className="text-yellow-400 text-2xl font-bold">$16.99</div>
                  <div className="text-gray-300 text-sm">شهرياً</div>
                  <div className="text-green-400 text-xs mt-1">أفضل قيمة!</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button 
                onClick={handleClose}
                className="w-full text-gray-400 hover:text-white text-sm transition-colors"
              >
                ربما لاحقاً
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}