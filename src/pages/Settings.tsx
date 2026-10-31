import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOutletContext } from "react-router-dom";
import type { ProfileOutletContext } from "@/types";

export default function Settings() {
  const { profile, profileLoading, profileError, retryProfile } =
    useOutletContext<ProfileOutletContext>();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Pengaturan Akun
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Kelola preferensi akun dan aplikasi GenFolio Anda.
        </p>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Profil Pengguna</CardTitle>
            <CardDescription>
              Informasi akun yang sedang masuk ke GenFolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError && (
              <div className="flex items-center gap-3 text-sm text-red-700">
                <span>Profil gagal dimuat.</span>
                <Button variant="outline" size="sm" onClick={retryProfile}>
                  Coba lagi
                </Button>
              </div>
            )}
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input id="name" value={profile?.name ?? ""} placeholder={profileLoading ? "Memuat..." : "—"} readOnly />
            </div>
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email ?? ""}
                placeholder={profileLoading ? "Memuat..." : "—"}
                readOnly
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferensi Sistem GA</CardTitle>
            <CardDescription>
              Sesuaikan parameter lanjutan untuk Algoritma Genetika (Khusus
              Expert).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
              Pengaturan hyperparameter saat ini dikunci secara default oleh
              sistem untuk menjamin konvergensi yang stabil.
            </div>
            <div className="grid gap-2 max-w-sm opacity-50">
              <Label htmlFor="popSize">Ukuran Populasi (Population Size)</Label>
              <Input id="popSize" type="number" defaultValue="200" disabled />
            </div>
            <div className="grid gap-2 max-w-sm opacity-50">
              <Label htmlFor="gen">Maksimum Generasi</Label>
              <Input id="gen" type="number" defaultValue="300" disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
