import { useState } from "react";
import axios from "axios";
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
import { Briefcase, CheckCircle2, AlertCircle } from "lucide-react";
import { authService, type SignupResponse } from "@/services/authService";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setname] = useState("");
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const [loading, setloading] = useState(false);
  const [error, seterror] = useState<string | null>(null);
  const [fieldErrors, setfieldErrors] = useState<Record<string, string>>({});
  const [success, setsuccess] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setloading(true);
    seterror(null);
    setfieldErrors({});
    setsuccess(null);

    try {
      const result: SignupResponse = await authService.signup(
        name,
        email,
        password,
      );

      if (result.status === "error") {
        // data bisa berupa array {field, issue} (validasi) atau null (mis. duplikat)
        if (Array.isArray(result.data)) {
          // petakan error per field: { password: "..." }
          const mapped: Record<string, string> = {};
          for (const item of result.data) {
            // buang prefix "Value error, " bila ada
            mapped[item.field] = item.issue.replace(/^Value error,\s*/i, "");
          }
          setfieldErrors(mapped);
          seterror("Periksa kembali data yang Anda isi.");
        } else {
          seterror(result.message); // contoh: "Email atau username sudah terdaftar."
        }
        return;
      }

      // ===== SUKSES: tampilkan notifikasi animasi, lalu redirect =====
      setsuccess(result.message); // "Signup berhasil. Silakan login."
      setTimeout(() => {
        navigate("/login", {
          state: { message: result.message },
        });
      }, 1800); // beri waktu user melihat notifikasi
    } catch (err) {
      // Error dari backend (HTTPException / validasi FastAPI) masuk ke sini
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as
          | { detail?: string | Array<{ loc: (string | number)[]; msg: string }>; message?: string }
          | Array<{ loc: (string | number)[]; msg: string }>
          | undefined;

        const isValidationArr = Array.isArray(data);
        const detailArr = isValidationArr
          ? data
          : data && Array.isArray(data.detail)
            ? data.detail
            : null;

        if (detailArr) {
          const mapped: Record<string, string> = {};
          for (const item of detailArr) {
            const field = item.loc[item.loc.length - 1];
            if (typeof field === "string" && field !== "body") {
              // buang prefix "Value error, " bila ada
              mapped[field] = item.msg.replace(/^Value error,\s*/i, "");
            }
          }
          if (Object.keys(mapped).length > 0) {
            setfieldErrors(mapped);
            seterror("Periksa kembali data yang Anda isi.");
          } else {
            seterror("Data yang dikirim tidak valid.");
          }
        } else if (data && !isValidationArr && typeof data.detail === "string") {
          // HTTPException: detail = string (mis. 401 "Email sudah terdaftar")
          seterror(data.detail.replace(/^Value error,\s*/i, ""));
        } else if (data && !isValidationArr && typeof data.message === "string") {
          seterror(data.message);
        } else if (err.response) {
          seterror(`Terjadi kesalahan pada server (kode ${err.response.status}).`);
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
            Buat Akun Baru
          </h1>
          <p className="text-slate-500 mt-2">
            Mulai perjalanan investasi optimal Anda
          </p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Daftar</CardTitle>
            <CardDescription>
              Lengkapi data diri Anda di bawah ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* ===== Notifikasi SUKSES (banner hijau animasi) ===== */}
            {success && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {success}
                  </p>
                  <p className="text-xs text-green-600">
                    Mengalihkan ke halaman masuk...
                  </p>
                </div>
              </div>
            )}

            {/* ===== Notifikasi ERROR umum ===== */}
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  required
                  value={name}
                  onChange={(e) => setname(e.target.value)}
                  className={
                    fieldErrors.name
                      ? "border-red-400 focus-visible:ring-red-300"
                      : ""
                  }
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600 animate-in fade-in duration-200">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  required
                  value={email}
                  onChange={(e) => setemail(e.target.value)}
                  className={
                    fieldErrors.email
                      ? "border-red-400 focus-visible:ring-red-300"
                      : ""
                  }
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 animate-in fade-in duration-200">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setpassword(e.target.value)}
                  className={
                    fieldErrors.password
                      ? "border-red-400 focus-visible:ring-red-300"
                      : ""
                  }
                />
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 animate-in fade-in duration-200">
                    {fieldErrors.password}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Minimal 8 karakter, mengandung huruf dan simbol.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base mt-2"
                disabled={loading || !!success}
              >
                {loading ? "Membuat Akun..." : "Buat Akun"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t pt-6 gap-4">
            <div className="text-center text-sm text-slate-500">
              Sudah punya akun?{" "}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                Masuk di sini
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
