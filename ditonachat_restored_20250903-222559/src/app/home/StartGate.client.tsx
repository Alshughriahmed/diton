
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { useAnalytics } from "@/hooks/useAnalytics";
import Link from "next/link";

const LS_GENDER = 'home:gender';
const LS_AGEOK = 'home:ageOk';

export default function StartGate() {
  const [gender, setGender] = useState<string>('');
  const [ageOk, setAgeOk] = useState<boolean>(false);
  const user = useUser();
  const router = useRouter();
  const analytics = useAnalytics();

  // تحميل الحالة من LocalStorage
  useEffect(() => {
    try {
      const g = localStorage.getItem(LS_GENDER) || '';
      const a = localStorage.getItem(LS_AGEOK) === 'true';
      setGender(g);
      setAgeOk(a);
    } catch {}
  }, []);

  // حفظ التغييرات
  useEffect(() => {
    try {
      localStorage.setItem(LS_GENDER, gender);
      localStorage.setItem(LS_AGEOK, ageOk.toString());
    } catch {}
  }, [gender, ageOk]);

  const isLoaded = useMemo(() => user !== undefined, [user]);

  useEffect(() => {
    if (isLoaded && user) {
      analytics.track("app_session_start");
      router.push("/chat");
    }
  }, [isLoaded, user, analytics, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          مرحباً بك
        </h1>
        
        {!ageOk && (
          <div className="mb-6">
            <p className="text-white text-center mb-4">
              هل عمرك 18 سنة أو أكبر؟
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setAgeOk(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
              >
                نعم
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg"
              >
                لا
              </button>
            </div>
          </div>
        )}

        {ageOk && (
          <div className="mb-6">
            <p className="text-white text-center mb-4">
              اختر نوعك:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['ذكر', 'أنثى'].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`py-2 px-4 rounded-lg ${
                    gender === g
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {ageOk && gender && (
          <Link 
            href="/chat"
            className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-center py-3 rounded-lg font-semibold transition duration-300"
          >
            ادخل للدردشة 🚀
          </Link>
        )}
      </div>
    </div>
  );
}
