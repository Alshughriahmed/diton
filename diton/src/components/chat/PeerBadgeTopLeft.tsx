"use client";
import usePeerMeta from "@/hooks/usePeerMeta";

type Props = {
  avatarUrl?: string | null;
  name?: string;
  likes?: number;
  isVip?: boolean;
};

export default function PeerBadgeTopLeft({ avatarUrl, name = "Guest", likes = 0, isVip = false }: Props) {
  const meta = usePeerMeta();
  const dAvatar = (meta?.avatarUrl ?? avatarUrl) || "/avatar.svg";
  const dName = meta?.name ?? name;
  const dLikes = typeof meta?.likes === "number" ? meta.likes : (likes ?? 0);

  return (
    <div className="flex items-center gap-2">
      <img src={dAvatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
      <div className="flex flex-col leading-tight">
        <span className="text-[12px] font-medium">{dName}</span>
        <span className="text-[11px] opacity-70">
          ❤ {dLikes} {isVip && <span className="ml-1 px-1 py-[1px] text-[10px] rounded bg-yellow-500/20 border border-yellow-500/40">VIP</span>}
        </span>
      </div>
    </div>
  );
}
