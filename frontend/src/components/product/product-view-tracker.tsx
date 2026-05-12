"use client";
import { useEffect } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";

export function ProductViewTracker({ productId }: { productId: string }) {
  const track = useTrackEvent();
  useEffect(() => {
    track("view", productId);
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
