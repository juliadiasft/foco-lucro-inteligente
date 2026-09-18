import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Sem conexão, uma ação (salvar, arquivar, pedir) falha na hora e avisa: por
  // padrão o react-query a deixaria na fila, com o botão girando, e ela dispararia
  // sozinha quando a internet voltasse — decidido por quem já tinha desistido.
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { networkMode: "always" } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
