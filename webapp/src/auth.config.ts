import NextAuth, { NextAuthConfig } from "next-auth"

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    authorized({ request, auth }) {
      // const { pathname } = request.nextUrl
      // if (pathname === "/middleware-example") return !!auth
      return true
    },
    async jwt({ token, account, user, profile }: { token: any; account: any; user: any, profile?: any }) {
      // Initial sign in
      if (account && user) {
        // TODO Handle gh users and oauth tokens
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        }
      }

      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      session.user = token.user
      session.error = token.error

      return session
    },
  },
  providers: [], // Providers are defined in auth.ts
  debug: process.env.NODE_ENV !== "production" ? true : false,
} satisfies NextAuthConfig;
