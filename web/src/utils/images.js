export function normalizeImageUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  let normalizedValue = rawValue;
  if (normalizedValue.startsWith("//")) {
    normalizedValue = `https:${normalizedValue}`;
  } else if (!/^(https?:|data:|blob:)/i.test(normalizedValue)) {
    normalizedValue = `https://${normalizedValue}`;
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    if (parsedUrl.hostname.includes("drive.google.com")) {
      const fileMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/);
      const fileId = fileMatch?.[1] || parsedUrl.searchParams.get("id");
      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    if (parsedUrl.hostname.includes("dropbox.com")) {
      parsedUrl.searchParams.set("raw", "1");
      return parsedUrl.toString();
    }

    if (parsedUrl.hostname === "github.com" && parsedUrl.pathname.includes("/blob/")) {
      const rawPath = parsedUrl.pathname.replace("/blob/", "/");
      return `https://raw.githubusercontent.com${rawPath}`;
    }

    return parsedUrl.toString();
  } catch {
    return normalizedValue;
  }
}
