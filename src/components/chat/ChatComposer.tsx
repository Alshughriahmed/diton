"use client";

"use client";

import { useState, useRef } from "react";
import { useVip } from "@/hooks/useVip";
import EmojiPicker from "./EmojiPicker";

interface ChatComposerProps {
  onSend: (message: string) => void;
}

export default function ChatComposer({ onSend }: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isVip } = useVip();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="relative p-4 bg-gray-800 border-t border-gray-700">
      {showEmoji && (
        <EmojiPicker
          onPick={(emoji) => {
            const el = inputRef.current;
            if (!el) return;
            const start = el.selectionStart || el.value.length;
            const end = el.selectionEnd || start;
            const newValue = el.value.slice(0, start) + emoji + el.value.slice(end);
            setMessage(newValue);
            el.focus();
            setTimeout(() => {
              el.selectionStart = el.selectionEnd = start + emoji.length;
            }, 0);
            setShowEmoji(false);
          }}
        />
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="chat-input"
          ref={inputRef}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={500}
        />
        <button
          type="button"
          data-testid="emoji-button"
          onClick={(e) => {
            e.preventDefault();
            setShowEmoji(v => !v);
          }}
          className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          😀
        </button>
        <button
          type="submit"
          disabled={!message.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
