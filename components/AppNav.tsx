"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { NavBar, type NavBarProps } from "@westy/shared/ui";

/**
 * NavBar renders plain <a> tags, so a click is a full page reload — which
 * would reset MockWestyClient's in-memory singleton state (see lib/mock/
 * index.ts) on every nav click. This wrapper intercepts clicks on internal
 * links and does a client-side transition instead, so demo state (e.g. a
 * just-filed dispute) survives navigating via the nav bar.
 */
export function AppNav(props: NavBarProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href || !href.startsWith("/")) return;
    event.preventDefault();
    router.push(href);
  }

  return (
    <div onClick={handleClick}>
      <NavBar {...props} />
    </div>
  );
}
