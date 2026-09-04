import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, AlertCircle } from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { authService } from "@/services/authService";

export default function Login() {
  const navigate = useNavigate();
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const [loading, setloading] = useState(false);
  const [error, seterror] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setloading(true);
    seterror(null);

    try {
      await authService.login(email, password);

      // ===== SUKSES: baru pindah ke /portfolio =====
      navigate("/portfolio");
    } catch (err) {
      // Error dari backend (HTTPException / validasi FastAPI) masuk ke sini
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as
          | { detail?: string; message?: string }
          | undefined;

        if (data && typeof data.detail === "string") {
          // HTTPException: detail = string (mis. 401 "Email atau password salah")
          seterror(data.detail);
        } else if (data && typeof data.message === "string") {
          seterror(data.message);
        } else if (err.response) {
          seterror(
            `Terjadi kesalahan pada server (kode ${err.response.status}).`,
          );
        } else {
          seterror("Tidak dapat terhubung ke server. Coba lagi.");
        }
      } else {
        seterror("Tidak dapat terhubung ke server. Coba lagi.");
      }
    } finally {
      setloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center text-center">
          <div className="bg-blue-600 p-3 rounded-2xl mb-4">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Selamat datang kembali
          </h1>
          <p className="text-slate-500 mt-2">Masuk ke akun GenFolio Anda</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Login</CardTitle>
            <CardDescription>
              Masukkan email dan kata sandi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* ===== Notifikasi ERROR ===== */}
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  required
                  value={email}
                  onChange={(e) => setemail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Kata Sandi</Label>
                  <a
                    href="#"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Lupa kata sandi?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setpassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base"
                disabled={loading}
              >
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t pt-6 gap-4">
            <div className="text-center text-sm text-slate-500">
              Belum punya akun?{" "}
              <Link
                to="/signup"
                className="font-semibold text-blue-600 hover:underline"
              >
                Daftar sekarang
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
