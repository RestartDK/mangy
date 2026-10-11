import { auth } from "@mangy/auth";

/**
 * Extracts the authenticated user from a request's session
 * @returns The user object if authenticated, null otherwise
 */
export const getSessionUser = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }
  return session.user;
};
