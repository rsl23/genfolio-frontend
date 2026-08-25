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

export default function Settings() {
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
              Ubah detail informasi pribadi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input id="name" defaultValue="Raoul Stanley" />
            </div>
            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue="raoul@example.com"
                disabled
              />
            </div>
            <Button className="mt-2 bg-blue-600 hover:bg-blue-700">
              Simpan Perubahan
            </Button>
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
