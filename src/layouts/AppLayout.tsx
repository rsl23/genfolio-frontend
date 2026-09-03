import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Briefcase,
  LayoutDashboard,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export default function AppLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Portofolio Saya", path: "/portfolio", icon: LayoutDashboard },
    { name: "Rekomendasi Baru", path: "/generate", icon: Sparkles },
    { name: "Pengaturan", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Drawer on Mobile, Static on Desktop) */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <div className="flex items-center gap-2 text-xl text-blue-800">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-blue-600 text-white shadow-btn">
              <Briefcase className="w-5 h-5" />
            </span>
            <span className="font-heading font-bold tracking-tight">
              GenFolio
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-muted-foreground hover:bg-muted p-1 rounded-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-slate-600 hover:bg-muted hover:text-slate-900 border border-transparent"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border bg-muted/40">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
              RK
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">
                Raoul Stanley
              </p>
              <p className="text-xs text-muted-foreground truncate">Investor</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Mobile Header (Hamburger) */}
        <header className="md:hidden flex items-center justify-between bg-card border-b border-border p-4 shadow-sm z-10">
          <div className="flex items-center gap-2 text-lg text-blue-800">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-blue-600 text-white">
              <Briefcase className="w-5 h-5" />
            </span>
            <span className="font-heading font-bold tracking-tight">
              GenFolio
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-muted rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Page Content Wrapper (Inherited by all sub-pages) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
          <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
