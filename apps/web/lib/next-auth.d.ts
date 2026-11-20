import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "ORGANIZER" | "SUPERADMIN";
      status: string;
    } & DefaultSession["user"];
  }
}
