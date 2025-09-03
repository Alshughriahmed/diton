export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
import type { Viewport } from 'next';
import { redirect } from "next/navigation";
import HeaderLite from "@/components/HeaderLite";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      {/* Header مع أزرار التسجيل */}
      <header className="w-full flex justify-between items-center px-6 py-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-white">DitonaChat</h2>
          <span className="px-2 py-1 border border-red-400 rounded-full text-red-400 text-xs font-semibold">18+</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link 
            href="/api/auth/signin"
            className="text-white hover:text-gray-300 transition-colors font-medium"
          >
            تسجيل الدخول
          </Link>
          <Link 
            href="/api/auth/signin"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-all font-medium"
          >
            إنشاء حساب
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 mt-8 bg-[url('/hero.webp.webp')] bg-cover bg-center bg-no-repeat">
        {/* Hero Section للدخول السريع */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            مرحباً بك في DitonaChat
          </h1>
          <p className="text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
            تواصل مع أشخاص جدد من جميع أنحاء العالم في بيئة آمنة وممتعة
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-lg text-white/80 mb-12">
            <div className="flex items-center">
              <span className="mr-2">🌍</span>
              <span>مستخدمون من كل العالم</span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">🔒</span>
              <span>محادثات آمنة ومشفرة</span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">⚡</span>
              <span>اتصال فوري وسريع</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
          <Link 
            href="/chat"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-lg transition duration-300 transform hover:scale-105 text-lg shadow-xl"
          >
            ابدأ الدردشة الآن 🚀
          </Link>
          <Link 
            href="/api/auth/signin"
            className="border-2 border-white/30 hover:border-white/50 text-white font-bold py-4 px-8 rounded-lg transition duration-300 backdrop-blur-sm text-lg"
          >
            سجل للحصول على ميزات إضافية
          </Link>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-white mb-2">دردشة فورية</h3>
            <p className="text-gray-200">تحدث مع أشخاص جدد فوراً بدون تأخير</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">🎥</div>
            <h3 className="text-xl font-bold text-white mb-2">مكالمات فيديو</h3>
            <p className="text-gray-200">شاهد وتحدث مع الأصدقاء الجدد وجهاً لوجه</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold text-white mb-2">بيئة آمنة</h3>
            <p className="text-gray-200">نظام أمان متقدم لحمايتك أثناء التصفح</p>
          </div>
        </div>
      </main>
    </div>
  );
}