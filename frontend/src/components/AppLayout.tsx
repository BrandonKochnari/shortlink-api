import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-cloud text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/dashboard" className="text-xl font-semibold tracking-normal">
            Shortlink
          </NavLink>
          <nav className="flex flex-wrap items-center justify-end gap-2">
            {isAuthenticated &&
              navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "rounded-md px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-ink text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-ink",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            {isAuthenticated && (
              <div className="flex items-center gap-2">
                {user?.email && (
                  <span className="hidden max-w-48 truncate text-sm text-slate-500 sm:inline">
                    {user.email}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
