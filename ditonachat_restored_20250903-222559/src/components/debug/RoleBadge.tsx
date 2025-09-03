"use client";

import { useSession } from "next-auth/react";
import { useVip } from "@/hooks/useVip";

export default function RoleBadge() {
  const { data: session, status } = useSession();
  const { isVip } = useVip();

  const getRoleInfo = () => {
    if (status === "loading") return { role: "loading", color: "bg-gray-500" };
    if (!session) return { role: "guest", color: "bg-red-500" };
    if (isVip) return { role: "vip", color: "bg-purple-500" };
    return { role: "user", color: "bg-blue-500" };
  };

  const { role, color } = getRoleInfo();

  return (
    <div className="fixed top-4 left-4 z-50">
      <div className={`${color} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
        {role.toUpperCase()}
      </div>
    </div>
  );
}