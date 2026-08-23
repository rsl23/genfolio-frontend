import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
