"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LocaleProvider } from "./locale-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 15, retry: 1, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={client}><LocaleProvider>{children}</LocaleProvider></QueryClientProvider>;
}

