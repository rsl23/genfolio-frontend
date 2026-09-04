import type { TokenResponse } from "@/types";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getRefreshToken = (): string | null =>
  localStorage.getItem(REFRESH_KEY);

export const setTokens = (token: TokenResponse): void => {
  localStorage.setItem(TOKEN_KEY, token.access_token);
  if (token.refresh_token) {
    localStorage.setItem(REFRESH_KEY, token.refresh_token);
  }
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};
