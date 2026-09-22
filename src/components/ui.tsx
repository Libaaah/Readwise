import { Bell, ChevronDown, Menu, Search, Settings, X } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn, initials } from "../utils";
import type { Lesson, NavItem } from "../types";

export function Logo() {
  return (
    <Link to="/student/dashboard" className="flex items-center gap-3" aria-label="READWISE home">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-base font-extrabold text-white shadow-soft">
        RW
      </div>
      <div>
        <div className="text-lg font-extrabold tracking-normal text-navy">READWISE</div>
        <div className="text-xs font-medium text-muted">Read. Practice. Progress.</div>
      </div>
    </Link>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "success" | "ghost";
  loading?: boolean;
};

export function Button({ className, variant = "primary", loading, disabled, children, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-primary text-white hover:bg-[#3157D9]",
    secondary: "bg-[#EEF3FF] text-primary hover:bg-[#E2EAFF]",
    outline: "border border-border bg-white text-text hover:border-primary hover:text-primary",
    danger: "bg-danger text-white hover:bg-[#C84646]",
    success: "bg-success text-white hover:bg-[#278A56]",
    ghost: "bg-transparent text-muted hover:bg-[#EEF3FF] hover:text-primary",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ className, variant = "primary", to, children }: { className?: string; variant?: ButtonProps["variant"]; to: string; children: ReactNode }) {
  const variants = {
    primary: "bg-primary text-white hover:bg-[#3157D9]",
    secondary: "bg-[#EEF3FF] text-primary hover:bg-[#E2EAFF]",
    outline: "border border-border bg-white text-text hover:border-primary hover:text-primary",
    danger: "bg-danger text-white hover:bg-[#C84646]",
    success: "bg-success text-white hover:bg-[#278A56]",
    ghost: "bg-transparent text-muted hover:bg-[#EEF3FF] hover:text-primary",
  };
  return (
    <Link
      to={to}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition", variants[variant ?? "primary"], className)}
    >
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border border-border bg-white p-5 shadow-soft", className)}>{children}</section>;
}

export function Input({ label, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-sm font-semibold text-text">{label}</span> : null}
      <input
        className={cn(
          "h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-text placeholder:text-quiet transition focus:border-primary",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}

export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-sm font-semibold text-text">{label}</span> : null}
      <select className={cn("h-12 w-full rounded-xl border border-border bg-white px-3 text-sm text-text", className)} {...props}>
        {children}
      </select>
    </label>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-border bg-white pl-11 pr-4 text-sm text-text placeholder:text-quiet"
      />
    </label>
  );
}

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "orange" | "purple" | "red" | "gray" }) {
  const tones = {
    blue: "bg-[#EEF3FF] text-primary",
    green: "bg-[#E8F7EF] text-success",
    orange: "bg-[#FFF4DE] text-[#9A6500]",
    purple: "bg-[#F2EEFF] text-purple",
    red: "bg-[#FCEBEB] text-danger",
    gray: "bg-[#F3F5FA] text-muted",
  };
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-lg" };
  return <div className={cn("grid place-items-center rounded-full bg-[#EEF3FF] font-bold text-primary", sizes[size])}>{initials(name)}</div>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2.5 w-full rounded-full bg-[#EDF0F7]", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function CircularProgress({ value, label, color = "#4169F5" }: { value: number; label: string; color?: string }) {
  const stroke = 10;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg className="h-32 w-32" viewBox="0 0 112 112" role="img" aria-label={`${label}: ${value}`}>
        <circle cx="56" cy="56" r={radius} stroke="#EDF0F7" strokeWidth={stroke} fill="none" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="61" textAnchor="middle" className="fill-text text-xl font-extrabold">
          {value}
        </text>
      </svg>
      <span className="text-sm font-semibold text-muted">{label}</span>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "blue" }: { label: string; value: string | number; icon: React.ElementType; tone?: "blue" | "green" | "orange" | "purple" }) {
  const tones = {
    blue: "bg-[#EEF3FF] text-primary",
    green: "bg-[#E8F7EF] text-success",
    orange: "bg-[#FFF4DE] text-warning",
    purple: "bg-[#F2EEFF] text-purple",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-text">{value}</div>
          <div className="text-sm font-medium text-muted">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-xl bg-[#EEF3FF] p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn("min-h-10 whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-muted transition", active === tab && "bg-white text-primary shadow-sm")}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/35 p-4" role="dialog" aria-modal="true">
      <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-text">{title}</h2>
          <button onClick={onClose} aria-label="Close modal" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-[#EEF3FF]">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function LessonCard({ lesson, compact = false }: { lesson: Lesson; compact?: boolean }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className={cn("flex min-h-32 items-end p-4", lesson.color)}>
        <div className="rounded-xl bg-white/80 px-3 py-2 text-sm font-extrabold text-navy">{lesson.category}</div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={lesson.difficulty === "Easy" ? "green" : lesson.difficulty === "Challenging" ? "purple" : "orange"}>{lesson.level}</Badge>
          <span className="text-xs font-semibold text-muted">{lesson.duration} min</span>
          <span className="text-xs font-semibold text-muted">Rating {lesson.rating}</span>
        </div>
        <h3 className="text-lg font-bold text-text">{lesson.title}</h3>
        {!compact ? <p className="mt-2 flex-1 text-sm leading-6 text-muted">{lesson.description}</p> : null}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-muted">
            <span>{lesson.status}</span>
            <span>{lesson.progress}%</span>
          </div>
          <ProgressBar value={lesson.progress} />
        </div>
        <LinkButton className="mt-5 w-full" to={`/student/reading/${lesson.id}`}>
          {lesson.progress > 0 ? "Continue" : "Start"} Lesson
        </LinkButton>
      </div>
    </Card>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-2 font-semibold text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="bg-white">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-y border-border px-4 py-4 first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="grid place-items-center py-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#EEF3FF] text-2xl font-extrabold text-primary">RW</div>
      <h3 className="text-lg font-bold text-text">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
    </Card>
  );
}

export function LoadingSkeleton() {
  return <div className="h-28 animate-pulse rounded-2xl bg-[#EDF0F7]" />;
}

export function Toast({ message }: { message: string }) {
  return message ? <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-soft">{message}</div> : null;
}

export function Dropdown() {
  return (
    <button className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text">
      Profile <ChevronDown className="h-4 w-4 text-muted" />
    </button>
  );
}

export function AppLayout({ nav, children, user, subtitle }: { nav: NavItem[]; children: ReactNode; user: { name: string; role: string }; subtitle: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-border bg-white p-5 lg:flex lg:flex-col">
        <SidebarContent nav={nav} user={user} />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-navy/35" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-[290px] bg-white p-5 shadow-soft">
            <SidebarContent nav={nav} user={user} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="grid h-11 w-11 place-items-center rounded-xl border border-border lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden flex-1 md:block">
              <SearchBar value="" onChange={() => undefined} placeholder="Search demo lessons and students" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-white" aria-label="Notifications">
                <Bell className="h-5 w-5 text-muted" />
              </button>
              <Avatar name={user.name} />
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-text">{user.name}</div>
                <div className="text-xs font-medium text-muted">{subtitle}</div>
              </div>
              <Dropdown />
            </div>
          </div>
        </header>
        <main key={location.pathname} className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ nav, user, onNavigate }: { nav: NavItem[]; user: { name: string; role: string }; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Logo />
      <nav className="mt-8 flex flex-col gap-1">
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-[#EEF3FF] hover:text-primary", isActive && "bg-[#EEF3FF] text-primary")
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <NavLink to="/student/dashboard" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-[#EEF3FF] hover:text-primary">
          <Settings className="h-5 w-5" />
          MVP Settings
        </NavLink>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
          <Avatar name={user.name} />
          <div>
            <div className="text-sm font-bold text-text">{user.name}</div>
            <div className="text-xs font-medium text-muted">{user.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
