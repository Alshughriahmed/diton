"use client";

interface PeerMetadataProps {
  country?: string;
  city?: string;
  gender?: string;
  age?: number;
}

export default function PeerMetadata({ country, city, gender, age }: PeerMetadataProps) {
  const chips = [];

  if (country) {
    chips.push({ label: country, icon: "🌍", type: "country" });
  }
  
  if (city) {
    chips.push({ label: city, icon: "🏙️", type: "city" });
  }
  
  if (gender) {
    const genderConfig = {
      male: { icon: "♂", color: "text-blue-400 border-blue-400/30" },
      female: { icon: "♀", color: "text-pink-400 border-pink-400/30" },
      couple: { icon: "👫", color: "text-purple-400 border-purple-400/30" },
      lgbt: { icon: "🏳️‍🌈", color: "text-rainbow border-rainbow/30" }
    };
    const config = genderConfig[gender as keyof typeof genderConfig] || { icon: "👤", color: "text-gray-400 border-gray-400/30" };
    chips.push({ label: gender, icon: config.icon, type: "gender", color: config.color });
  }

  if (age) {
    chips.push({ label: `${age}`, icon: "🎂", type: "age" });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-3 left-3 z-30">
      <div className="flex flex-wrap gap-1.5 max-w-48">
        {chips.map((chip, index) => (
          <div
            key={`${chip.type}-${index}`}
            className={`bg-black/60 backdrop-blur-md rounded-lg px-2 py-1 border border-white/10 shadow-sm ${
              chip.color || 'text-white border-white/10'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs">{chip.icon}</span>
              <span className="text-xs font-medium capitalize truncate max-w-16">
                {chip.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}