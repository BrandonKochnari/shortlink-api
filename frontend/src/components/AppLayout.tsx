import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-cloud text-ink">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-xl font-semibold tracking-normal">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </span>
            <span>Shortlink</span>
          </NavLink>
          <nav className="flex flex-wrap items-center justify-end gap-2">
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
                  className="btn-secondary"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
