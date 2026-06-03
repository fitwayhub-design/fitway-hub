/**
 * Athlete Chat page — REMOVED (May 2026).
 *
 * 1:1 chat is gone. The Tickets system replaces it for coach communication,
 * and challenge/group conversations live inside Community. This stub stays
 * so any deep links / push notifications routed here resolve to a
 * predictable redirect.
 *
 * To rebuild a chat page later, undo this file from git history — the
 * router (App.tsx) and nav (AppLayout.tsx) need to be re-wired too.
 */
import { Navigate } from "react-router-dom";

export default function ChatRemoved() {
  return <Navigate to="/app/community" replace />;
}
