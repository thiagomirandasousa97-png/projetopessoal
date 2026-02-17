import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Scissors,
  DollarSign,
  BarChart3,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

import { useAppConfig } from "@/lib/app-config";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Profissionais", url: "/profissionais", icon: UserCog },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { config } = useAppConfig();

  const logoSize = Math.max(28, Math.min(140, config.logoSizePx || 56));

  const Logo = (
    <div className="rounded-full bg-black/10 p-1.5 shadow-sm border border-white/10">
      {config.logoImageDataUrl ? (
        <img
          src={config.logoImageDataUrl}
          alt="Logo do salão"
          className="rounded-full object-cover"
          style={{ width: logoSize, height: logoSize }}
        />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-full font-semibold text-white"
          style={{ width: logoSize, height: logoSize, backgroundColor: config.buttonColor }}
        >
          {(config.logoText || "SD").slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex w-72 flex-col fixed inset-y-0 z-30 border-r" style={{ backgroundColor: config.backgroundColor, color: config.textColor, borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex flex-col items-start gap-3 px-6 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {Logo}
          {config.showSalonName && config.salonName ? (
            <span className="font-display text-xl font-semibold" style={{ color: config.textColor }}>
              {config.salonName}
            </span>
          ) : null}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors")}
                style={active ? { backgroundColor: `${config.buttonColor}33`, color: config.textColor } : { color: `${config.textColor}CC` }}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs truncate" style={{ color: `${config.textColor}CC` }}>{user?.email}</p>
          <button onClick={() => void logout()} className="text-xs underline">Sair</button>
          <p className="text-xs" style={{ color: `${config.textColor}99` }}>© 2026 {config.salonName || "Salão"}</p>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-40 border-b" style={{ backgroundColor: config.backgroundColor, color: config.textColor, borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="scale-[0.65] origin-left">{Logo}</div>
            {config.showSalonName && config.salonName ? (
              <span className="font-display text-lg font-semibold" style={{ color: config.textColor }}>{config.salonName}</span>
            ) : null}
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="md:hidden fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
            <motion.nav initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-72 h-full pt-16 px-3 py-4 space-y-1" style={{ backgroundColor: config.backgroundColor, color: config.textColor }} onClick={(e) => e.stopPropagation()}>
              {navItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <Link key={item.url} to={item.url} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors" style={active ? { backgroundColor: `${config.buttonColor}33`, color: config.textColor } : { color: `${config.textColor}CC` }}>
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 md:ml-72 mt-14 md:mt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
