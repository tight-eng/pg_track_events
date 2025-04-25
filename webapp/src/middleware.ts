import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"
import NextAuth from "next-auth"

const { auth } = NextAuth(authConfig)

// @ts-expect-error Need to track down NextAuthRequest type (and `any` doesn't make it happy either)
export default auth((req: any) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/signin')
  // TODO Setup protected routes
  const isProtectedRoute = !isAuthPage

  if (isAuthPage) {
    if (isLoggedIn) {
      const from = req.nextUrl.searchParams.get('from')
      return NextResponse.redirect(new URL(from || '/', req.url))
    }
    return null
  }

  if (!isLoggedIn && isProtectedRoute) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    return NextResponse.redirect(
      new URL(`/signin?from=${encodeURIComponent(from)}`, req.url)
    );
  }

  return null
})

// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
