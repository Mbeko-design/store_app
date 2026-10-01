import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./BottomNav";
import { ErrorBoundary } from "./ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

/**
 * AppShell — one layout for every screen.
 * Desktop: right navy sidebar + header + content grid.
 * Tablet (<lg): sidebar collapses into a drawer (hamburger in header).
 * Mobile (<md): compact header + bottom navigation, content padded above it.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh bg-page">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader onMenu={() => setSidebarOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-10">
          <ErrorBoundary key={location.pathname}>{children ?? <Outlet />}</ErrorBoundary>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
