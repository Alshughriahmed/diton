
"use client";

import { useState, useEffect } from 'react';

export default function TranslationToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('ar');

  const languages = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
  ];

  const translateMessage = async (text: string, targetLang: string) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target: targetLang })
      });
      const data = await response.json();
      return data.translated;
    } catch (error) {
      console.error('Translation failed:', error);
      return text;
    }
  };

  useEffect(() => {
    if (isEnabled) {
      // إضافة event listener للرسائل الجديدة
      const handleNewMessage = async (event: CustomEvent) => {
        const { message, messageId } = event.detail;
        if (message && message.language !== targetLanguage) {
          const translated = await translateMessage(message.text, targetLanguage);
          
          // إضافة الترجمة للرسالة
          const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
          if (messageElement) {
            const translationDiv = document.createElement('div');
            translationDiv.className = 'translation-overlay';
            translationDiv.innerHTML = `
              <div class="bg-blue-100 text-blue-800 text-sm p-2 mt-1 rounded border-l-4 border-blue-400">
                🌐 ${translated}
              </div>
            `;
            messageElement.appendChild(translationDiv);
          }
        }
      };

      window.addEventListener('message:received', handleNewMessage as unknown as EventListener);
      return () => window.removeEventListener('message:received', handleNewMessage as unknown as EventListener);
    }
  }, [isEnabled, targetLanguage]);

  return (
    <div className="relative">
      {/* زر تفعيل الترجمة */}
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={`p-2 rounded-lg transition-all ${
          isEnabled 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        title="Auto Translation"
      >
        🌐
      </button>

      {/* قائمة اللغات */}
      {isEnabled && (
        <div className="absolute bottom-12 right-0 bg-white border rounded-lg shadow-xl p-2 min-w-48">
          <div className="text-sm font-bold mb-2 text-gray-700">ترجمة إلى:</div>
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setTargetLanguage(lang.code)}
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center gap-2 ${
                targetLanguage === lang.code ? 'bg-blue-100 text-blue-700' : ''
              }`}
            >
              <span>{lang.flag}</span>
              <span className="text-sm">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
