"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLink } from "@/components/nav-link";
import { MobileNav, HamburgerButton } from "@/components/mobile-nav";

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b-2 border-default bg-card relative z-30">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <span className="text-lg font-semibold text-foreground font-inter">Shorts Analyzer</span>
          </div>
          
          {/* Desktop Navigation - Hidden on mobile */}
          <nav className="hidden lg:block absolute left-1/2 transform -translate-x-1/2">
            <div className="flex items-center gap-6">
              <NavLink href="/niche-discovery" label="Niche Discovery" />
              <NavLink href="/script-writer" label="Script Writer" />
              <NavLink href="/trends" label="Trending" />
              <NavLink href="/" label="Analyzer" />
              <NavLink href="/resources" label="Resources" />
              <NavLink href="/monitoring" label="Monitoring" />
            </div>
          </nav>
          
          {/* Right side - Desktop theme toggle and mobile hamburger */}
          <div className="flex items-center gap-3">
            {/* Theme toggle - only show on desktop */}
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            <HamburgerButton isOpen={mobileMenuOpen} setIsOpen={setMobileMenuOpen} />
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <MobileNav isOpen={mobileMenuOpen} setIsOpen={setMobileMenuOpen} />

      {/* Main content */}
      {children}
    </>
  );
}
