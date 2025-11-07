import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: ['/', '/intake(.*)', '/api/public(.*)', '/api/leads', '/api/uploads(.*)']
});

export const config = {
  matcher: ['/((?!_next|.*\..*).*)']
};
