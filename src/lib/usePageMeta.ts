import { useEffect } from "react";

/**
 * Sets document.title for the lifetime of a page (restores the previous title
 * on unmount). The server already injects the correct <title> for the initial
 * crawl/share of public pages; this keeps the tab title correct during
 * client-side navigation. Pass null/undefined to leave the title untouched
 * (e.g. while data is still loading).
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

export default usePageTitle;
