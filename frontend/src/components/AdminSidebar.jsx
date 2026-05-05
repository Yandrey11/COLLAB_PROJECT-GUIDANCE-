import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AdminTopNav from "./AdminTopNav";

const TOPNAV_CLAIM_KEY = "__admin_topnav_claimed__";

/**
 * Backward-compatible export: pages still import AdminSidebar.
 * The sidebar UI has been replaced by the new top navigation bar.
 */
export default function AdminSidebar() {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window[TOPNAV_CLAIM_KEY]) return undefined;

    window[TOPNAV_CLAIM_KEY] = true;
    const previousPaddingTop = document.body.style.paddingTop;
    const previousAnchorOffset = document.documentElement.style.scrollPaddingTop;
    document.body.style.paddingTop = "80px";
    document.documentElement.style.scrollPaddingTop = "80px";
    setIsOwner(true);

    return () => {
      window[TOPNAV_CLAIM_KEY] = false;
      document.body.style.paddingTop = previousPaddingTop;
      document.documentElement.style.scrollPaddingTop = previousAnchorOffset;
    };
  }, []);

  if (!isOwner || typeof document === "undefined") {
    return null;
  }

  return createPortal(<AdminTopNav />, document.body);
}
