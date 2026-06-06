export const FAST_POLL_MS = 3000;
export const STANDARD_POLL_MS = 5000;

export function bindVisibilityRefresh(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function refreshOnFocus() {
    callback();
  }

  function refreshOnVisible() {
    if (document.visibilityState === "visible") {
      callback();
    }
  }

  window.addEventListener("focus", refreshOnFocus);
  document.addEventListener("visibilitychange", refreshOnVisible);

  return () => {
    window.removeEventListener("focus", refreshOnFocus);
    document.removeEventListener("visibilitychange", refreshOnVisible);
  };
}
