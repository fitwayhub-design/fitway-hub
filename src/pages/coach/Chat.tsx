/**
 * Coach Chat page — REMOVED (May 2026).
 *
 * Coaches no longer DM athletes. They get athlete questions through
 * /coach/tickets instead. This stub stays as a redirect so old bookmarks
 * still land somewhere useful.
 */
import { Navigate } from "react-router-dom";

export default function CoachChatRemoved() {
  return <Navigate to="/coach/tickets" replace />;
}
