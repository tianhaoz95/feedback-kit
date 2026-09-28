import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { afterPreviews, type AfterPreview } from "@/lib/previews";
import type { FeedbackEvent } from "@/lib/types";

export interface SignedPreview extends AfterPreview {
  url: string | null;
}

/**
 * A report's after-fix previews with signed URLs, for the screenshot
 * viewer's After view. Reloads when the report's loop state changes (a new
 * preview usually arrives with a stage change, and so does expiry).
 */
export function useAfterPreviews(feedbackId: string | null, refreshKey: unknown): SignedPreview[] {
  const [previews, setPreviews] = useState<SignedPreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!feedbackId) {
      setPreviews([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("feedback_events")
        .select("*")
        .eq("feedback_id", feedbackId)
        .eq("kind", "after_screenshot")
        .order("created_at", { ascending: true });
      const list = afterPreviews((data ?? []) as FeedbackEvent[]);
      const paths = list.flatMap((p) => (p.path ? [p.path] : []));
      const urls: Record<string, string> = {};
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("feedback-screenshots").createSignedUrls(paths, 3600);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
      }
      if (!cancelled) setPreviews(list.map((p) => ({ ...p, url: p.path ? urls[p.path] ?? null : null })));
    })();
    return () => {
      cancelled = true;
    };
  }, [feedbackId, refreshKey]);

  return previews;
}
