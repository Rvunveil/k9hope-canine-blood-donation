import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto-js';

// We need to access the cookie encryption key
// Note: In middleware (Edge runtime), we might not have access to full crypto-js in same way or env vars might behave differently.
// However, if we just check for EXISTENCE of cookies, it might be enough for a basic check.
// If we want to decrypt, we need to ensure the key is available.
// For now, let's strictly check for presence of cookies to avoid redirect loops.

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Don't redirect on login page
    if (pathname === '/login') {
        return NextResponse.next();
    }

    // Check for auth cookies
    const userIdCookie = request.cookies.get('userId');
    const roleCookie = request.cookies.get('role');

    // Protected routes pattern
    // /app/h for hospital/veterinary
    // /app/d for donor
    // /app/p for patient
    // /app/o for organisation
    // /onboarding

    const protectedRoutes = ['/app/h', '/app/d', '/app/p', '/app/o', '/onboarding'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtectedRoute) {
        // If no auth cookies, redirect to login
        // We check specifically if role is NOT guest if possible, but the cookie value is encrypted.
        // So if the cookie exists, we assume user is logged in (client side will validate and redirect if invalid).
        // This middle ware prevents immediate access if absolutely no cookies are present.

        if (!userIdCookie || !roleCookie) {
            console.log(`Middleware: No auth cookies found for ${pathname}, redirecting to login`);
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/app/:path*',
        '/onboarding/:path*',
    ],
};
