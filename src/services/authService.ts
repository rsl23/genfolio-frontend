import apiClient from "./apiClient";
import type { ApiResponse, TokenResponse } from "@/types";
import { clearTokens, setTokens } from "./tokenStorage";
import axios from "axios";

/** Envelope ApiResponse dari backend untuk endpoint signup */
export interface FieldIssue {
  field: string;
  issue: string;
}
export interface SignupResponse {
  status: "success" | "error";
  message: string;
  data: { detail?: string } | FieldIssue[] | null;
}

export const authService = {
  /**
   * Login email + password. Backend mengembalikan access token (15 menit)
   * dan refresh token (7 hari). Token otomatis disimpan ke localStorage.
   */
  login: async (
    email: string,
    password: string,
  ): Promise<ApiResponse<TokenResponse>> => {
    const response = await apiClient.post<ApiResponse<TokenResponse>>(
      "/api/v1/auth/login",
      { email, password },
    );
    setTokens(response.data.data);
    return response.data;
  },

  /**
   * Daftar user baru. Tidak mengembalikan token — user harus login setelahnya.
   */
  signup: async (
    name: string,
    email: string,
    password: string,
  ): Promise<SignupResponse> => {
    const response = await apiClient.post<SignupResponse>(
      "/api/v1/auth/signup",
      { email, password, name },
    );
    return response.data;
  },

  /**
   * Tukar refresh token dengan access token baru.
   * PENTING: backend membaca token dari header `Authorization: Bearer`,
   */
  refreshToken: async (
    refreshToken: string,
  ): Promise<ApiResponse<TokenResponse>> => {
    const response = await axios.post<ApiResponse<TokenResponse>>(
      `${apiClient.defaults.baseURL}/api/v1/auth/refresh`,
      null,
      { headers: { Authorization: `Bearer ${refreshToken}` }, timeout: 15000 },
    );
    // Backend mengembalikan refresh token lama yang masih valid
    setTokens(response.data.data);
    return response.data;
  },

  /** Contoh endpoint terproteksi untuk cek sesi aktif */
  me: async (): Promise<ApiResponse<{ detail: string }>> => {
    const response =
      await apiClient.get<ApiResponse<{ detail: string }>>("/api/v1/auth/me");
    return response.data;
  },

  /** Hapus sesi lokal (backend kamu stateless JWT, tidak perlu panggil API) */
  logout: (): void => {
    clearTokens();
  },
};
