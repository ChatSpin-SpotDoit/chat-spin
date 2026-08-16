import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token["googleId"] = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token["googleId"]) {
        (session.user as { id?: string }).id = token["googleId"] as string;
      }
      return session;
    },
  },
};

const nextAuthInstance = NextAuth(authConfig);

export const handlers = nextAuthInstance.handlers;

export function auth(...args: Parameters<typeof nextAuthInstance.auth>) {
  return nextAuthInstance.auth(...args);
}

export function signIn(...args: Parameters<typeof nextAuthInstance.signIn>) {
  return nextAuthInstance.signIn(...args);
}

export function signOut(...args: Parameters<typeof nextAuthInstance.signOut>) {
  return nextAuthInstance.signOut(...args);
}
