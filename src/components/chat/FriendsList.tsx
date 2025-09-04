
"use client";

import { useState, useEffect } from 'react';

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  country?: string;
  mutualLikes: number;
}

export default function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/friends/list');
      const data = await response.json();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChatWithFriend = (friendId: string) => {
    window.location.href = `/chat?friend=${friendId}`;
  };

  return (
    <>
      {/* زر قائمة الأصدقاء */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all z-40"
        title="Friends List"
      >
        👥
        {friends.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {friends.length}
          </span>
        )}
      </button>

      {/* Modal قائمة الأصدقاء */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">👥 أصدقائي</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">جاري التحميل...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>لا يوجد أصدقاء بعد</p>
                  <p className="text-sm mt-2">ابدأ المحادثات لإضافة أصدقاء!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                      onClick={() => startChatWithFriend(friend.id)}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {friend.name[0]}
                        </div>
                        {friend.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{friend.name}</span>
                          {friend.country && <span className="text-lg">{friend.country}</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {friend.isOnline ? (
                            <span className="text-green-600">🟢 متصل الآن</span>
                          ) : friend.lastSeen ? (
                            `آخر ظهور: ${friend.lastSeen.toLocaleDateString()}`
                          ) : (
                            'غير متصل'
                          )}
                        </div>
                        {friend.mutualLikes > 0 && (
                          <div className="text-xs text-purple-600">
                            💖 {friend.mutualLikes} إعجاب متبادل
                          </div>
                        )}
                      </div>
                      
                      {/* Chat Button */}
                      <button className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-all">
                        دردشة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
