import { getRequestHeader } from "@tanstack/react-start/server";

export function getAppBaseUrl() {
  const configured = process.env.APP_URL;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("APP_URL precisa ser configurada no servidor");
  }
  const raw = configured || getRequestHeader("origin") || "http://localhost:3000";
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Endereço público inválido");
  }
  return url.origin;
}
