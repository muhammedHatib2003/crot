import { useEffect, useState } from "react";
import { normalizeImageUrl } from "../utils/images";

export default function RemoteImage({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  fallback = "No photo"
}) {
  const normalizedSrc = normalizeImageUrl(src);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || imageError) {
    return <div className={fallbackClassName}>{fallback}</div>;
  }

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={normalizedSrc}
      onError={() => setImageError(true)}
    />
  );
}
