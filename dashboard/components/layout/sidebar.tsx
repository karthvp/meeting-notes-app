'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Users,
  FolderKanban,
  AlertCircle,
  LayoutDashboard,
  ArrowRight,
  Settings,
  Cpu,
  LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Notes', href: '/notes', icon: FileText },
  { name: 'Uncategorized', href: '/uncategorized', icon: AlertCircle },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Rules', href: '/rules', icon: Cpu },
  { name: 'Templates', href: '/templates', icon: LayoutTemplate },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo Section */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/egen-notes-logo.png"
            alt="Egen Notes"
            width={120}
            height={40}
            className="dark:hidden object-contain"
            priority
          />
          <Image
            src="/egen-notes-logo-white.svg"
            alt="Egen Notes"
            width={120}
            height={40}
            className="hidden dark:block object-contain"
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium egen-transition',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {/* The Constant Arrow - shows on active/hover */}
              <ArrowRight
                className={cn(
                  'h-4 w-4 egen-arrow opacity-0 transition-opacity',
                  isActive ? 'opacity-100' : 'group-hover:opacity-50'
                )}
              />
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
