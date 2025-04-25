import NextAuth, { NextAuthConfig } from "next-auth"
import "next-auth/jwt"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { authConfig } from "@/auth.config"
import { usersTable, authAccountsTable, authVerificationTokensTable, authAuthenticatorsTable } from "@/db/schema/core"
import SlackProvider from "next-auth/providers/slack";
import ResendProvider from "next-auth/providers/resend"

const config = {
  adapter: DrizzleAdapter(db, {
    usersTable,
    accountsTable: authAccountsTable,
    verificationTokensTable: authVerificationTokensTable,
    authenticatorsTable: authAuthenticatorsTable,
  }),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
    }),
    ResendProvider({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "TightCRM Magic Link <magic@transactional-1.langburp.com>"
    }),
  ],
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config)
