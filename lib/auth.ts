import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/signin" },
  providers: [
    CredentialsProvider({
      name: "School account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const demoEmail = "demo@albayyan.edu";
        const demoPassword = "Albayyan-Demo-2026!";
        if (process.env.NODE_ENV !== "production" && email === demoEmail && password === demoPassword) {
          return { id: "demo-admin", name: "Demo Administrator", email, role: Role.ADMIN };
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await compare(password, user.passwordHash))) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
};