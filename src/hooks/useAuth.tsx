import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCurrentUser, logoutAccount } from "@/lib/api/auth.functions";
import type { SessionUser } from "@/lib/server/auth.server";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => undefined,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: () => getCurrentUser(),
    staleTime: 60_000,
    retry: false,
  });

  const signOut = async () => {
    await logoutAccount();
    queryClient.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        refresh: async () => {
          await refetch();
        },
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
