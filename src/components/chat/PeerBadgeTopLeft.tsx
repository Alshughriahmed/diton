"use client";
type Props = {
  avatarUrl?: string;
  name?: string;
  likes?: number;
  isVip?: boolean;
};
export default function PeerBadgeTopLeft({ avatarUrl, name="Guest", likes=0, isVip=false }: Props){
  return (
    <div className="absolute left-3 top-3 z-[40] flex items-center gap-3 rounded-xl bg-black/50 backdrop-blur px-3 py-2 border border-white/10">
      <img src={avatarUrl || "/avatar.svg"} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-[11px] opacity-70">❤ {likes} {isVip && <span className="ml-1 px-1 py-[1px] text-[10px] rounded bg-yellow-500/20 border border-yellow-500/40">VIP</span>}</span>
      </div>
    </div>
  );
}