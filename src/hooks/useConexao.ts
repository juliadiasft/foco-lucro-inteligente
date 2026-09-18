import { useSyncExternalStore } from "react";

function assinar(ouvinte: () => void) {
  window.addEventListener("online", ouvinte);
  window.addEventListener("offline", ouvinte);
  return () => {
    window.removeEventListener("online", ouvinte);
    window.removeEventListener("offline", ouvinte);
  };
}

// No servidor e na hidratação vale "online": o servidor não sabe da conexão de
// quem vai abrir a página, e a faixa só aparece depois, no navegador.
export function useOnline() {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );
}
