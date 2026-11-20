import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/routers/root.js";

/**
 * The single client-side tRPC hook object every component imports
 * (`trpc.matches.list.useQuery()`, etc). Wired up to React Query inside
 * <Providers> in app/providers.tsx.
 */
export const trpc = createTRPCReact<AppRouter>();
