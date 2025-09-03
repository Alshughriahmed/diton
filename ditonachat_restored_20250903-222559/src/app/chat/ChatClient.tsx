"use client";


import { useEffect, useState } from "react";
import nextDynamic from 'next/dynamic';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PeerHeader from "@/components/chat/PeerHeader";
import LowerRightQuick from "@/components/chat/LowerRightQuick";
import UpsellModal from "@/components/UpsellModal";
import { useVip } from "@/hooks/useVip";
import { busEmit } from "@/utils/bus";
import PeerMeta from "@/components/chat/PeerMeta";

// المكونات الجديدة
import SystemMonitor from "@/components/common/SystemMonitor";
import ErrorTracker from "@/components/common/ErrorTracker";
import HealthIndicator from "@/components/common/HealthIndicator";
import FriendsList from "@/components/chat/FriendsList";
import ScreenEffects from "@/components/chat/ScreenEffects";
import TranslationToggle from "@/components/chat/TranslationToggle";
import ARMasks from "@/components/chat/ARMasks";
import RoleBadge from "@/components/debug/RoleBadge";

const ChatMessages = nextDynamic(() => import('@/components/chat/ChatMessages'), { ssr: false });
const ChatComposer = nextDynamic(() => import('@/components/chat/ChatComposer'), { ssr: false });
const Toolbar = nextDynamic(() => import('@/components/chat/Toolbar'), { ssr: false });

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { isVip } = useVip();
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerInfo, setPeerInfo] = useState<any>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }
  }, [session, router]);

  const handleSendMessage = (message: string) => {
    if (!isVip && messages.length >= 10) {
      setShowUpsell(true);
      busEmit('upsell:triggered', { reason: 'guest_cap' });
      return;
    }

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
      {/* Role Badge for testing */}
      <RoleBadge />
      
      {/* المكونات الجديدة */}
      <SystemMonitor />
      <ErrorTracker />
      <ScreenEffects />
      <FriendsList />
      
      {/* Header مع مؤشر الصحة */}
      <div className="relative">
        <PeerHeader peer={peerInfo} />
        <div className="absolute top-4 right-4">
          <HealthIndicator />
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

      {/* Toolbar مع المزايا الجديدة */}
      <div className="relative">
        <Toolbar
          onNext={handleNext}
          onLike={handleLike}
          peerId={peerInfo?.id}
        />
        
        {/* أدوات إضافية - VIP gated */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <TranslationToggle />
          {isVip && <ARMasks />}
        </div>
      </div>

      <ChatComposer onSend={handleSendMessage} />

      <div className="absolute right-3 -top-24 z-[40]">
  <LowerRightQuick />
</div>

      {showUpsell && (
        <UpsellModal onClose={() => setShowUpsell(false)} />
      )}
    </div>
  );
}
