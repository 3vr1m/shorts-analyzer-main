"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  // No protection on navigation - let users browse freely
  return (
    <Link 
      href={href}
      className={`relative py-2 px-1 text-sm font-medium transition-colors duration-200 ${
        isActive 
          ? 'text-foreground' 
          : 'text-muted hover:text-foreground'
      }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
      )}
    </Link>
  );
}
