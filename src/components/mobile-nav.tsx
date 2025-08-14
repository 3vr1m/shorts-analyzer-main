"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

interface MobileNavProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function MobileNav({ isOpen, setIsOpen }: MobileNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Analyzer" },
    { href: "/niche-discovery", label: "Niche Discovery" },
    { href: "/script-writer", label: "Script Writer" },
    { href: "/trends", label: "Trending" },
    { href: "/resources", label: "Resources" },
    { href: "/monitoring", label: "Monitoring" },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Slide-out menu */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-card border-l-2 border-default z-50 transform transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-default">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <span className="text-lg font-semibold text-foreground font-inter">Shorts Analyzer</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme toggle in mobile menu */}
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-6">
          <div className="space-y-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    block px-4 py-3 rounded-lg font-medium transition-colors
                    ${isActive 
                      ? 'bg-accent text-white' 
                      : 'text-foreground hover:bg-muted'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="text-sm text-muted text-center">
            <p>AI-powered content creation</p>
            <p className="mt-1">Made with ✨ by Shorts Analyzer</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function HamburgerButton({ isOpen, setIsOpen }: MobileNavProps) {
  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
      aria-label="Toggle menu"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {isOpen ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
}
