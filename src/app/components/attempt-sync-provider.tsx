"use client";

import { useEffect } from "react";
import { syncPendingAttempts } from "@/app/data/student-attempt";

const SYNC_INTERVAL_MS = 30000;

export default function AttemptSyncProvider() {
  useEffect(() => {
    let stopped = false;

    const syncNow = async () => {
      if (stopped) {
        return;
      }

      if (!window.navigator.onLine) {
        return;
      }

      try {
        await syncPendingAttempts();
      } catch {
        // Keep silent to avoid interrupting students during quiz.
      }
    };

    const onOnline = () => {
      void syncNow();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && window.navigator.onLine) {
        void syncNow();
      }
    };

    void syncNow();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(() => {
      void syncNow();
    }, SYNC_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
