"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useFilters } from "@/state/filters";

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: number;
  emoji?: string;
  isScrolling?: boolean;
}

interface MessageSystemProps {
  onSend?: (message: string) => void;
  isGuest?: boolean;
}

export default function MessageSystem({ onSend, isGuest = false }: MessageSystemProps) {
  const { data: session } = useSession();
  const { isVip } = useFilters();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScrollMode, setIsScrollMode] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Guest limitations
  const MAX_GUEST_MESSAGES = 3;
  const canSendMessage = !isGuest || messageCount < MAX_GUEST_MESSAGES;

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mock incoming messages for demo
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const mockMessages = [
          "Hey there! 👋",
          "How are you doing?",
          "Nice to meet you!",
          "What's your favorite hobby?",
          "Beautiful day isn't it? ☀️",
          "Love your style! 😍",
          "Where are you from?",
          "Want to be friends? 💕"
        ];
        
        const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        addMessage(randomMessage, 'peer');
      }
    }, 15000 + Math.random() * 10000); // Random interval 15-25s

    return () => clearInterval(interval);
  }, []);

  const addMessage = (text: string, sender: 'me' | 'peer', emoji?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: Date.now(),
      emoji,
      isScrolling: isScrollMode
    };

    setMessages(prev => {
      // Keep only last 20 messages for performance
      const updated = [...prev, newMessage];
      return updated.slice(-20);
    });

    if (sender === 'me') {
      setMessageCount(prev => prev + 1);
      onSend?.(text);
    }
  };

  const sendQuickEmoji = (emoji: string) => {
    if (!canSendMessage) {
      alert("Guest users can only send 3 messages. Sign up for unlimited messaging!");
      return;
    }
    
    addMessage(emoji, 'me', emoji);
  };

  const toggleScrollMode = () => {
    setIsScrollMode(!isScrollMode);
    if (!isScrollMode) {
      setShowEmoji(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowEmoji(false), 3000);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Quick emoji reactions
  const quickEmojis = ['😀', '😍', '🔥', '👍', '❤️', '😂', '🤔', '👋', '💕', '😘'];

  return (
    <div className="relative">
      {/* Messages Display - Only show last 3 for overlay */}
      {messages.length > 0 && (
        <div className="absolute bottom-16 left-4 right-4 pointer-events-none">
          <div 
            ref={scrollContainerRef}
            className="space-y-2 max-h-32 overflow-hidden"
          >
            {messages.slice(-3).map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.sender === 'me'
                      ? 'bg-blue-600 text-white ml-8'
                      : 'bg-gray-700 text-gray-100 mr-8'
                  } ${message.isScrolling ? 'animate-scroll-right' : ''} backdrop-blur border border-white/20`}
                >
                  {message.emoji ? (
                    <span className="text-2xl">{message.emoji}</span>
                  ) : (
                    <>
                      <p>{message.text}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {formatTime(message.timestamp)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Scroll/Emoji Mode Toggle */}
        <button
          onClick={toggleScrollMode}
          className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
            isScrollMode
              ? "bg-purple-600 border-purple-500 text-white"
              : "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
          }`}
          title={isScrollMode ? "Exit scroll mode" : "Enter scroll mode"}
        >
          {isScrollMode ? "📜" : "💬"}
        </button>

        {/* Quick Emoji Panel */}
        {showEmoji && (
          <div className="flex gap-1 animate-fade-in">
            {quickEmojis.slice(0, 6).map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendQuickEmoji(emoji)}
                disabled={!canSendMessage}
                className={`w-8 h-8 rounded text-lg hover:bg-gray-700 transition-colors ${
                  !canSendMessage ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Send emoji"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Message Counter for Guests */}
        {isGuest && (
          <div className="px-2 py-1 bg-yellow-600/20 border border-yellow-500/30 rounded text-xs text-yellow-200">
            {messageCount}/{MAX_GUEST_MESSAGES} messages
          </div>
        )}

        {/* VIP Upgrade Notice */}
        {!session && !isVip && messageCount >= MAX_GUEST_MESSAGES && (
          <div className="px-2 py-1 bg-red-600/20 border border-red-500/30 rounded text-xs text-red-200">
            Sign up for unlimited messages!
          </div>
        )}
      </div>

      {/* Full Chat Modal (VIP Feature) */}
      {isVip && messages.length > 3 && (
        <button
          onClick={() => {/* TODO: Open full chat modal */}}
          className="absolute -top-8 right-0 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
        >
          View All ({messages.length})
        </button>
      )}
    </div>
  );
}

/* CSS Animations */
const animationStyles = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scroll-right {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }

  .animate-scroll-right {
    animation: scroll-right 0.5s ease-out;
  }
`;

// Inject styles
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = animationStyles;
  document.head.appendChild(styleSheet);
}