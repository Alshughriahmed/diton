"use client";

import { useEffect, useState } from "react";
import nextDynamic from 'next/dynamic';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PeerMeta from "@/components/chat/PeerMeta";
import { busEmit } from "@/utils/bus";

const ChatMessages = nextDynamic(() => import('@/components/chat/ChatMessages'), { ssr: false });

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerInfo, setPeerInfo] = useState<any>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }
  }, [session, router]);

  const handleSendMessage = (message: string) => {
    setMessages(prev => [...prev, { text: message, sender: 'me' }]);
  };

  const handleNext = () => {
    busEmit('match:next');
  };

  const handleLike = () => {
    busEmit('peer:like', { peerId: peerInfo?.id });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="relative">
        <div className="p-4 bg-gray-800 text-white">
          <h1 className="text-xl font-bold">DitonaChat</h1>
        </div>
        {/* DitonaChat: BEGIN peer-meta mount */}
        <div className="absolute inset-0 pointer-events-none">
          <PeerMeta 
            country={peerInfo?.country || ""} 
            city={peerInfo?.city || ""} 
            gender={peerInfo?.gender || "unknown"} 
          />
        </div>
        {/* DitonaChat: END peer-meta mount */}
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatMessages messages={messages} />
      </div>

      {/* Toolbar */}
      <div className="relative p-4 bg-gray-800">
        <div className="flex gap-4 justify-center">
          <button 
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            Next
          </button>
          <button 
            onClick={handleLike}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
          >
            Like
          </button>
        </div>
      </div>

      {/* Quick Dock anchor */}
      <div className="absolute right-3 -top-24 z-[40]">
        <div className="text-white text-sm">Quick Actions</div>
      </div>

      {/* Chat Input */}
      <div className="p-4 bg-gray-700">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded bg-gray-600 text-white"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}