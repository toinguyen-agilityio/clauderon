import type { Adapter, AdapterSession, AdapterUser } from "next-auth/adapters";
import type { Clock } from "@clauderon/core";
import {
  createSession,
  endSession,
  findMemberByAccount,
  findMemberByEmail,
  findMemberById,
  linkMemberAccount,
  loadSession,
  updateMemberProfile,
  upsertMember,
  type Db,
  type Member,
} from "@clauderon/db";

function toUser(m: Member): AdapterUser {
  return { id: m.id, email: m.email, emailVerified: null, name: m.name, image: m.pictureUrl };
}

const orNull = (m: Member | null) => (m ? toUser(m) : null);

/**
 * Auth.js over the Clauderon schema (spec M0 §7): Members, server-side
 * sessions stored by token hash, and account links without OAuth tokens
 * (NFR-1). Loading a session re-checks the allowlist.
 */
export function clauderonAdapter(db: Db, operators: readonly string[], clock: Clock): Adapter {
  return {
    async createUser(user) {
      return toUser(await upsertMember(db, { email: user.email, name: user.name ?? null, pictureUrl: user.image ?? null }, clock.now()));
    },
    getUser: async (id) => orNull(await findMemberById(db, id)),
    getUserByEmail: async (email) => orNull(await findMemberByEmail(db, email)),
    getUserByAccount: async ({ provider, providerAccountId }) => orNull(await findMemberByAccount(db, provider, providerAccountId)),
    async updateUser(user) {
      return toUser(await updateMemberProfile(db, user.id, { name: user.name ?? null, pictureUrl: user.image ?? null }));
    },
    async linkAccount(account) {
      // Only the link: access, refresh and id tokens are deliberately dropped.
      await linkMemberAccount(db, { provider: account.provider, providerAccountId: account.providerAccountId, memberId: account.userId });
    },
    async createSession({ sessionToken, userId }) {
      const row = await createSession(db, userId, sessionToken, clock.now());
      return { sessionToken, userId, expires: row.expiresAt };
    },
    async getSessionAndUser(sessionToken) {
      const live = await loadSession(db, sessionToken, operators, clock.now());
      if (!live) return null;
      const session: AdapterSession = { sessionToken, userId: live.member.id, expires: live.session.expiresAt };
      return { session, user: toUser(live.member) };
    },
    // Sessions last 24 hours from sign-in and are never extended (MEM-1).
    async updateSession() {
      return null;
    },
    async deleteSession(sessionToken) {
      await endSession(db, sessionToken, clock.now());
    },
  };
}
