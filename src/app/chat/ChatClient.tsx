"use client";
import FilterBar from "@/components/filters/FilterBar";
import PeerBadgeTopLeft from "@/components/chat/PeerBadgeTopLeft";
import PeerMetaBottomLeft from "@/components/chat/PeerMetaBottomLeft";
import UserTopRightControls from "@/components/chat/UserTopRightControls";
import ChatToolbar from "@/components/chat/ChatToolbar";
import { useGestures } from "@/hooks/useGestures";


import { useEffect, useState } from "react";
import nextDynamic from 'next/dynamic';
import { useRouter } from "next/navigation";
import PeerHeader from "@/components/chat/PeerHeader";
import LowerRightQuick from "@/components/chat/LowerRightQuick";
import UpsellModal from "@/components/UpsellModal";
import { useVip } from "@/hooks/useVip";
import { busEmit } from "@/utils/bus";
import { useFilters } from "@/state/filters";
import { shouldEmitNext } from "@/utils/next-dedupe";

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
  useGestures();
  const session = { user: { name: "Guest" } }; // Mock session for demo
  const router = useRouter();
  const { isVip } = useVip();
  const { gender, countries } = useFilters();
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peerInfo, setPeerInfo] = useState<any>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    // Authentication skipped for demo mode
  }, [router]);

  const handleSendMessage = (message: string) => {
    if (!isVip && messages.length >= 10) {
      setShowUpsell(true);
      busEmit('upsell:triggered', { reason: 'guest_cap' });
      return;
    }

    setMessages(prev => [...prev, { text: message, sender: 'me' }]);
  };

  const handleNext = () => {
    // Read filters from store
    const currentGender = gender || 'all';
    const currentCountries = countries && countries.length > 0 ? countries : ['ALL'];
    
    // Create payload for dedupe
    const payload = `${currentGender}|${currentCountries.join(',')}`;
    
    // Check dedupe before proceeding
    if (!shouldEmitNext(payload)) return;
    
    // Dev logging
    console.debug('[CLIENT_NEXT]', { gender: currentGender, countries: currentCountries, t: Date.now() });
    
    // Fire-and-forget fetch to match API - wrapped in try/catch to fix toast issues
    try {
      const queryParams = new URLSearchParams({
        gender: currentGender,
        countries: currentCountries.join(',')
      });
      fetch(`/api/match/next?${queryParams.toString()}`, { cache: 'no-store' }).catch((error) => {
        console.debug('[FETCH_ERROR]', error); // Only debug log, no toast
      });
    } catch (error) {
      console.debug('[FETCH_ERROR]', error); // Only debug log, no toast
    }
    
    // Keep existing bus behavior
    busEmit('match:next');
  };

  const handleLike = () => {
    busEmit('peer:like', { peerId: peerInfo?.id });
  };

  return (
    <div className="grid grid-rows-2 min-h-screen bg-gray-900">
      {/* gesture root for touch events */}
      <div data-testid="gesture-root"></div>
      
      {/* Global components */}
      <RoleBadge />
      <SystemMonitor />
      <ErrorTracker />
      <ScreenEffects />
      <FriendsList />
      
      {/* Top Section - Peer Video Area (Upper Half) */}
      <div className="relative row-span-1 bg-gray-800 overflow-hidden">
        {/* Peer header with health indicator */}
        <div className="relative h-full">
          <PeerHeader peer={peerInfo} />
          <div className="absolute top-4 right-4">
            <HealthIndicator />
          </div>
        </div>
        
        {/* Top-left (upper/peer): PeerBadgeTopLeft */}
        <PeerBadgeTopLeft />
        
        {/* Bottom-left (upper/peer): PeerMetaBottomLeft */}
        <PeerMetaBottomLeft />
        
        {/* Top-right (upper/peer): FilterBar */}
        <div className="absolute right-3 top-3 z-[40]" data-testid="quick-dock-anchor">
          <FilterBar />
          <LowerRightQuick />
        </div>
      </div>

      {/* Bottom Section - Self Video/Chat Area (Lower Half) */}
      <div className="relative row-span-1 bg-gray-900 flex flex-col">
        {/* Chat messages area */}
        <div className="flex-1 overflow-hidden p-4">
          <ChatMessages messages={messages} />
        </div>
        
        {/* Chat composer */}
        <div className="p-4">
          <ChatComposer onSend={handleSendMessage} />
        </div>
        
        {/* Existing toolbar with additional features */}
        <div className="relative">
          <Toolbar
            onNext={handleNext}
            onLike={handleLike}
            peerId={peerInfo?.id}
          />
          
          {/* VIP gated tools */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <TranslationToggle />
            {isVip && <ARMasks />}
          </div>
        </div>
        
        {/* Top-right (lower/self): UserTopRightControls */}
        <UserTopRightControls />
        
        {/* Bottom (lower/self): ChatToolbar */}
        <ChatToolbar />
      </div>

      {showUpsell && (
        <UpsellModal onClose={() => setShowUpsell(false)} />
      )}
    </div>
  );
}