"use client";
import safeFetch from '@/app/chat/safeFetch';

import { useState, useEffect } from "react";
import { useFilters } from "@/state/filters";

interface Friend {
  id: string;
  username?: string;
  avatar?: string;
  lastSeen: string;
  isOnline: boolean;
  mutualLikes: number;
  country?: string;
  gender?: string;
}

export default function FriendsView() {
  const { isVip } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'liked' | 'likedBy'>('liked');

  useEffect(() => {
    if (isOpen && isVip) {
      loadFriends();
    }
  }, [isOpen, isVip, activeTab]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const response = await safeFetch(`/api/user/friends?type=${activeTab}`);
      const data = await response.json();
      setFriends(data.friends || []);
    } catch (error) {
      console.warn('Failed to load friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await safeFetch('/api/user/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      });
      setFriends(prev => prev.filter(f => f.id !== friendId));
    } catch (error) {
      console.warn('Failed to remove friend:', error);
    }
  };

  const handleStartChat = (friend: Friend) => {
    // Implementation for starting a chat with a specific friend
    setIsOpen(false);
    console.log('Starting chat with:', friend);
  };

  const getFlagEmoji = (country?: string) => {
    if (!country) return '🌍';
    // Simple country code to flag emoji mapping
    const flags: Record<string, string> = {
      'US': '🇺🇸', 'DE': '🇩🇪', 'FR': '🇫🇷', 'GB': '🇬🇧', 
      'TR': '🇹🇷', 'AE': '🇦🇪', 'SA': '🇸🇦', 'EG': '🇪🇬',
      'JO': '🇯🇴', 'IQ': '🇮🇶', 'SY': '🇸🇾', 'LB': '🇱🇧'
    };
    return flags[country] || '🌍';
  };

  const getGenderEmoji = (gender?: string) => {
    switch (gender) {
      case 'male': return '♂️';
      case 'female': return '♀️';
      case 'couple': return '⚥';
      case 'lgbt': return '🏳️‍🌈';
      default: return '👤';
    }
  };

  const friendCount = friends.length;
  const onlineCount = friends.filter(f => f.isOnline).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          friendCount > 0
            ? "bg-purple-600 border-purple-500 text-white"
            : "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
        }`}
        aria-label="Friends"
      >
        <span className="text-lg">👥</span>
        <span className="hidden sm:inline">Friends</span>
        {friendCount > 0 && (
          <span className="bg-pink-500 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {friendCount > 99 ? '99+' : friendCount}
          </span>
        )}
        {!isVip && <span className="text-xs">🔒</span>}
      </button>

      {/* Friends Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {isVip ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-600">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Your Friends</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex mt-2 text-xs text-gray-400">
                  <span>{friendCount} total</span>
                  <span className="mx-2">•</span>
                  <span>{onlineCount} online</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-600">
                <button
                  onClick={() => setActiveTab('liked')}
                  className={`flex-1 px-4 py-2 text-sm ${
                    activeTab === 'liked'
                      ? "text-pink-400 border-b-2 border-pink-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  You Liked 💗
                </button>
                <button
                  onClick={() => setActiveTab('likedBy')}
                  className={`flex-1 px-4 py-2 text-sm ${
                    activeTab === 'likedBy'
                      ? "text-pink-400 border-b-2 border-pink-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Liked You 💖
                </button>
              </div>

              {/* Friends List */}
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-400 mx-auto"></div>
                    <p className="mt-2 text-xs">Loading friends...</p>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <span className="text-2xl">😔</span>
                    <p className="mt-2 text-xs">
                      {activeTab === 'liked' 
                        ? "No one liked yet. Start connecting!" 
                        : "No one liked you yet. Keep chatting!"}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        {/* Avatar */}
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                            {friend.avatar || friend.username?.charAt(0) || '?'}
                          </div>
                          {friend.isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-white text-sm font-medium truncate">
                              {friend.username || `User ${friend.id.slice(-4)}`}
                            </span>
                            <span className="text-xs">{getFlagEmoji(friend.country)}</span>
                            <span className="text-xs">{getGenderEmoji(friend.gender)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>💕 {friend.mutualLikes}</span>
                            <span>•</span>
                            <span>{friend.isOnline ? 'Online' : friend.lastSeen}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStartChat(friend)}
                            className="p-2 text-blue-400 hover:bg-blue-600/20 rounded transition-colors"
                            title="Start Chat"
                          >
                            💬
                          </button>
                          <button
                            onClick={() => handleRemoveFriend(friend.id)}
                            className="p-2 text-red-400 hover:bg-red-600/20 rounded transition-colors"
                            title="Remove"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* VIP Upgrade Notice */
            <div className="p-4">
              <div className="text-center">
                <span className="text-4xl">🔒</span>
                <h3 className="text-sm font-semibold text-white mt-2">VIP Feature</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Keep track of people you liked and who liked you!
                </p>
              </div>
              
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg">
                <div className="text-xs text-gray-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span>💗</span>
                    <span>See who you've liked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>💖</span>
                    <span>See who likes you</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>💬</span>
                    <span>Start direct chats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🔔</span>
                    <span>Get notifications</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}