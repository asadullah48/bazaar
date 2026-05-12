"use client";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = localStorage.getItem("sid");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("sid", sid);
  }
  return sid;
}

export function useTrackEvent() {
  return function track(
    event_type: "view" | "click" | "add_to_cart" | "purchase",
    product_id?: string,
    campaign_id?: string,
  ) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const session_id = getSessionId();
    fetch(`${base}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, event_type, product_id, campaign_id }),
    }).catch(() => {});
  };
}
