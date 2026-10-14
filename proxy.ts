import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const routeForRole: Record<string, string> = {
  ADMIN: "/",
  TEACHER: "/teacher",
  STUDENT: "/student",
  PARENT: "/parent",
};

export async function proxy(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return new NextResponse("Authentication is not configured. Set NEXTAUTH_SECRET and restart the app.", { status: 503 });
  }

  const token = await getToken({ req: request, secret });
  const role = typeof token?.role === "string" ? token.role : undefined;

  if (!role || !routeForRole[role]) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  const { pathname } = request.nextUrl;
  const permittedRoot = routeForRole[role];
  const isAdminRoot = pathname === "/" && role === "ADMIN";
  const isRoleRoute = pathname === permittedRoot || pathname.startsWith(`${permittedRoot}/`);
  const isApiRoute = pathname.startsWith("/api/");

  if (isAdminRoot || isRoleRoute || isApiRoute) return NextResponse.next();

  return NextResponse.redirect(new URL(permittedRoot, request.url));
}

export const config = {
  matcher: ["/((?!signin|api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};