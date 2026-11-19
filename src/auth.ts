import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  findUserForLogin,
  recordFailedLogin,
  recordSuccessfulLogin,
  findUserIdByMongoId,
} from "@/app/lib/repos/users";
import { isMongoId } from "@/app/lib/neon";
import bcrypt from "bcryptjs";

// Auth.js v5 ne transmet au client que le `type`/`code` des erreurs de type
// CredentialsSignin (tout le reste — y compris un Error générique — est réduit à
// l'erreur générique "Configuration" côté client, le vrai message restant loggé
// serveur uniquement). Voir node_modules/@auth/core/src/errors.ts (clientErrors)
// et node_modules/@auth/core/src/index.ts. Le code sert de clé de traduction côté front.
class UserNotFoundError extends CredentialsSignin {
  code = "user-not-found";
}
class InvalidPasswordError extends CredentialsSignin {
  code = "invalid-password";
}
class AccountLockedError extends CredentialsSignin {
  code = "account-locked";
}
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email-not-verified";
}

// Sessions émises avant la bascule vers Neon : le jeton contient l'ancien _id Mongo
// (24 hex). Il est converti en uuid via users.mongo_id, puis Auth.js réécrit le cookie
// (à chaque appel de /api/auth/session) : la conversion n'a lieu qu'une fois par navigateur.
// Cache par instance pour ne pas interroger la base à chaque requête d'ici là.
const legacyIdCache = new Map<string, string>();
const LEGACY_CACHE_MAX = 1000;

async function resolveLegacyUserId(mongoId: string): Promise<string | null> {
  const key = mongoId.toLowerCase();
  const cached = legacyIdCache.get(key);
  if (cached) return cached;
  const id = await findUserIdByMongoId(key);
  if (id) {
    if (legacyIdCache.size >= LEGACY_CACHE_MAX) legacyIdCache.clear();
    legacyIdCache.set(key, id);
  }
  return id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const user = await findUserForLogin(credentials.email);
        if (!user) throw new UserNotFoundError();

        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          throw new AccountLockedError();
        }

        const ok = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!ok) {
          await recordFailedLogin(user.id, new Date(Date.now() + 15 * 60 * 1000));
          throw new InvalidPasswordError();
        }

        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        await recordSuccessfulLogin(user.id, new Date());

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.emailVerified = (user as any).emailVerified;
      } else {
        const legacyId = [token.id, token.sub].find((v): v is string => isMongoId(v));
        if (legacyId) {
          try {
            const id = await resolveLegacyUserId(legacyId);
            // Compte absent de Neon : session invalidée (Auth.js supprime le cookie).
            if (!id) return null;
            token.id = id;
            token.sub = id;
          } catch (error) {
            // Ne jamais lever ici : Auth.js supprimerait le cookie (déconnexion). Le jeton
            // reste inchangé et la conversion sera retentée à la requête suivante.
            console.error("AUTH LEGACY SESSION ERROR:", error);
          }
        }
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.id ?? token.sub) as string;
      (session.user as any).role = token.role;
      (session.user as any).emailVerified = token.emailVerified;
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },
});
