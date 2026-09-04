import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "@/services/tokenStorage";

/**
 * Guard untuk route terproteksi.
 * Memeriksa apakah access token ada di localStorage:
 * - Ada   → render halaman (dengan AppLayout via <Outlet />)
 * - Tidak → redirect ke /login (simpan lokasi asal agar bisa kembali setelah login)
 *
 * CATATAN: ini guard sisi klien untuk UX. Perlindungan sesungguhnya tetap
 * dilakukan backend (endpoint terproteksi menolak request tanpa token valid).
 */
export default function ProtectedRoute() {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
