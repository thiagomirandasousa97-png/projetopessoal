import { useEffect, useState } from "react";

export type AppConfig = {
  salonName: string;
  showSalonName: boolean;
  logoText: string;
  logoImageDataUrl: string;
  logoSizePx: number;
  textColor: string;
  backgroundColor: string;
  buttonColor: string;
};

const STORAGE_KEY = "salao-app-config";

export const DEFAULT_CONFIG: AppConfig = {
  salonName: "Salão Danny Miranda",
  showSalonName: true,
  logoText: "SD",
  logoImageDataUrl: "",
  logoSizePx: 56,
  textColor: "#f5f5f5",
  backgroundColor: "#1f1a1c",
  buttonColor: "#d94678",
};

export function getAppConfig(): AppConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;

  try {
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      salonName: parsed.salonName ?? DEFAULT_CONFIG.salonName,
      showSalonName: parsed.showSalonName ?? DEFAULT_CONFIG.showSalonName,
      logoText: parsed.logoText ?? DEFAULT_CONFIG.logoText,
      logoImageDataUrl: parsed.logoImageDataUrl ?? DEFAULT_CONFIG.logoImageDataUrl,
      logoSizePx: parsed.logoSizePx ?? DEFAULT_CONFIG.logoSizePx,
      textColor: parsed.textColor ?? DEFAULT_CONFIG.textColor,
      backgroundColor: parsed.backgroundColor ?? DEFAULT_CONFIG.backgroundColor,
      buttonColor: parsed.buttonColor ?? DEFAULT_CONFIG.buttonColor,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAppConfig(config: AppConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("app-config-updated"));
}

export function resetAppConfig() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("app-config-updated"));
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(() => getAppConfig());

  useEffect(() => {
    const listener = () => setConfig(getAppConfig());
    window.addEventListener("app-config-updated", listener);
    return () => window.removeEventListener("app-config-updated", listener);
  }, []);

  return {
    config,
    setConfig: (next: AppConfig) => {
      saveAppConfig(next);
      setConfig(next);
    },
    reset: () => {
      resetAppConfig();
      setConfig(getAppConfig());
    },
  };
}
