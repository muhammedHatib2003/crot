import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getTableOrderLink } from "../../utils/tableOrderLinks";

export default function TableQrCode({ tableId, size = 112, className = "" }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const orderLink = getTableOrderLink(tableId);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSrc("");

    QRCode.toDataURL(orderLink, {
      width: Math.max(size * 2, 256),
      margin: 1,
      errorCorrectionLevel: "M"
    })
      .then((dataUrl) => {
        if (active) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [orderLink, size]);

  if (failed) {
    return (
      <div
        className={`flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500 ${className}`}
        style={{ width: size, height: size }}
      >
        QR oluşturulamadı
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`aspect-square animate-pulse rounded-xl bg-slate-200 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      alt="Masa sipariş QR kodu"
      className={`aspect-square rounded-xl bg-white object-contain ${className}`}
      height={size}
      src={src}
      width={size}
    />
  );
}

export async function createTableQrDataUrl(tableId, size = 280) {
  const orderLink = getTableOrderLink(tableId);
  return QRCode.toDataURL(orderLink, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M"
  });
}
