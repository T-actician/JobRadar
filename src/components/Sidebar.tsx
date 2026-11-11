import { Bell, Bookmark, ClipboardList, Cpu, Factory, GraduationCap, History, LayoutDashboard, List, Settings, Sparkles, User, UserPlus, Wrench, type LucideIcon } from 'lucide-react';
import type { View } from '../types';

export const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'recommended', label: 'Recommended', icon: Sparkles },
  { id: 'all', label: 'All Jobs', icon: List },
  { id: 'engineering', label: 'Engineering', icon: Wrench },
  { id: 'technology', label: 'Technology', icon: Cpu },
  { id: 'internships', label: 'Internships', icon: UserPlus },
  { id: 'attachments', label: 'Industrial Attachments', icon: Factory },
  { id: 'graduate', label: 'Graduate Programmes', icon: GraduationCap },
  { id: 'saved', label: 'Saved Jobs', icon: Bookmark },
  { id: 'applications', label: 'My Applications', icon: ClipboardList },
  { id: 'alerts', label: 'Job Alerts', icon: Bell },
  { id: 'recent', label: 'Recently Viewed', icon: History },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ view, onView, counts }: { view: View; onView: (v: View) => void; counts: Partial<Record<View, number>> }) {
  return (
    <nav aria-label="Main" className="w-56 shrink-0 overflow-y-auto border border-line/40 bg-panel/70 py-2">
      {NAV.map(({ id, label, icon: Icon }) => {
        const on = view === id;
        return (
          <button key={id} onClick={() => onView(id)} aria-current={on ? 'page' : undefined}
            className={`flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left text-xs transition focus:outline-none focus-visible:bg-cyan/10 ${on ? 'border-cyan bg-cyan/10 text-cyan' : 'border-transparent text-ink hover:bg-cyan/5 hover:text-cyan'}`}>
            <Icon size={15} />
            <span className="flex-1">{label}</span>
            {!!counts[id] && <span className="text-orange">{counts[id]}</span>}
          </button>
        );
      })}
    </nav>
  );
}
