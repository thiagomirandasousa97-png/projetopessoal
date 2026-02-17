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

let currentConfig: AppConfig = DEFAULT_CONFIG;

export function getAppConfig(): AppConfig {
  return currentConfig;
}

export function saveAppConfig(config: AppConfig) {
  currentConfig = config;
  window.dispatchEvent(new Event("app-config-updated"));
}

export function resetAppConfig() {
  currentConfig = DEFAULT_CONFIG;
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
