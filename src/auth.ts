import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
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
        await connectDB();

        const user = await User.findOne({ email: credentials.email });
        if (!user) throw new UserNotFoundError();

        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          throw new AccountLockedError();
        }

        const ok = await bcrypt.compare(credentials.password as string, user.password);
        if (!ok) {
          user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
          if (user.failedLoginAttempts >= 5) {
            user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          }
          await user.save();
          throw new InvalidPasswordError();
        }

        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        user.failedLoginAttempts = 0;
        user.accountLockedUntil = null;
        user.lastLoginAt = new Date();
        await user.save();

        return {
          id: user._id.toString(),
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
