import { useEffect, useState } from "react";

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "R";
}

export default function RestaurantLogo({ name, src, className = "" }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 font-bold text-brand-900 ${className}`}
    >
      {src && !imageError ? (
        <img
          alt={name ? `${name} logo` : "Restaurant logo"}
          className="h-full w-full object-cover"
          src={src}
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-center uppercase">{getInitials(name)}</span>
      )}
    </div>
  );
}
