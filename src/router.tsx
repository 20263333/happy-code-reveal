import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep recently loaded screens instant on slower self-hosted servers.
        // Cached data is shown immediately and refreshed in the background;
        // mutations explicitly invalidate the affected query keys.
        staleTime: 60_000,
        gcTime: 12 * 60 * 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        // Never flash a spinner when only the query key changed (filters,
        // period, pagination) — keep the previous rows on screen.
        placeholderData: keepPreviousData,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60_000,
    defaultPendingMs: 150,
  });

  return router;
};
