"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import { useFilters } from "@/state/filters";
import { toast } from "@/lib/ui/toast";

interface Message {
  id: string;
  text: string;
  timestamp: number;
  isOwn: boolean;
  sender?: {
    name: string;
    isVip: boolean;
  };
}

interface ChatMessagingProps {
  isVisible?: boolean;
  onToggle?: () => void;
}

export default function ChatMessaging({ isVisible = false, onToggle }: ChatMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isVip } = useFilters();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for incoming messages
    const offMessage = on("chat:messageReceived" as any, (data: any) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: data.text,
        timestamp: Date.now(),
        isOwn: false,
        sender: data.sender
      };
      setMessages(prev => [...prev.slice(-2), newMessage]); // Keep only last 3 messages
    });

    // Listen for typing indicators
    const offTyping = on("chat:typing" as any, (data: any) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      offMessage();
      offTyping();
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Check guest limits
    if (!isVip && messageCount >= 3) {
      emit("ui:upsell", "messaging");
      toast("🔒 الضيوف محدودون بـ 3 رسائل فقط");
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      timestamp: Date.now(),
      isOwn: true
    };

    setMessages(prev => [...prev.slice(-2), newMessage]); // Keep only last 3 messages
    setMessageCount(prev => prev + 1);
    
    try {
      // Send to backend
      await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });
    } catch (error) {
      console.warn('Message send failed:', error);
    }

    setInputText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[40]">
      <div className="bg-black/80 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm">💬 الرسائل</span>
            {!isVip && (
              <span className="text-xs text-orange-400">
                {messageCount}/3
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="h-48 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-white/50 text-sm py-8">
              ابدأ محادثة...
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                    message.isOwn
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  {!message.isOwn && message.sender && (
                    <div className="text-xs opacity-70 mb-1">
                      {message.sender.name}
                      {message.sender.isVip && (
                        <span className="ml-1 text-yellow-400">👑</span>
                      )}
                    </div>
                  )}
                  {message.text}
                </div>
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20">
                <span className="animate-pulse">يكتب...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={!isVip && messageCount >= 3 ? "🔒 اشترك في VIP للمزيد" : "اكتب رسالة..."}
              disabled={!isVip && messageCount >= 3}
              className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/20 focus:border-blue-500 focus:outline-none placeholder-white/50 disabled:opacity-50"
              maxLength={200}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || (!isVip && messageCount >= 3)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              إرسال
            </button>
          </div>
          
          {!isVip && (
            <div className="text-xs text-orange-400 mt-2 text-center">
              الضيوف محدودون بـ 3 رسائل - 
              <button 
                onClick={() => emit("ui:upsell", "messaging")}
                className="underline hover:text-orange-300 ml-1"
              >
                اشترك في VIP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}