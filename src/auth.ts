import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getUserDb } from '@/lib/userDb';

function upsertUser(email: string, name?: string | null, image?: string | null) {
    const db = getUserDb();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO users (email, name, image, created_at)
     VALUES (@email, @name, @image, @now)
     ON CONFLICT(email) DO UPDATE SET name=excluded.name, image=excluded.image`,
    ).run({ email, name: name ?? null, image: image ?? null, now });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    session: { strategy: 'jwt' },
    callbacks: {
        async signIn({ user }) {
            if (user?.email) {
                try {
                    upsertUser(user.email, user.name, (user as any).image || null);
                } catch (e) {
                    console.error('Failed to upsert user during signIn', e);
                }
                return true;
            }
            return false;
        },
        async jwt({ token, account, profile }) {
            // token.email already present; nothing special needed
            return token;
        },
        async session({ session, token }) {
            if (token?.email && session.user) {
                session.user.email = token.email as string;
            }
            return session;
        },
    },
});
