import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    /** Tijdstip (ms) waarop de rol het laatst uit de database gelezen werd. */
    roleCheckedAt?: number;
  }
}
