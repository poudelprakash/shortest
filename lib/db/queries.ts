"use server";

import { eq, gte } from "drizzle-orm";
import { db } from "./drizzle";
import { users, User, NewUser, pullRequests, PullRequest, repositories, Repository } from "./schema";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function updateUserSubscription(
  clerkId: string,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(users)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, clerkId));
}

async function createUser(clerkId: string): Promise<User> {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const newUser: NewUser = {
    clerkId,
    role: "member",
    name:
      clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.username || "",
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();
  return createdUser;
}

export async function getUserByClerkId(clerkId: string): Promise<User> {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  return createUser(clerkId);
}

export async function getPullRequests(): Promise<PullRequest[]> {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  return db.select().from(pullRequests).where(eq(pullRequests.userId, user.id));
}

export async function getCachedRepositories(cacheDuration: number): Promise<Repository[]> {
  const cacheThreshold = new Date(Date.now() - cacheDuration);
  return db
    .select()
    .from(repositories)
    .where(gte(repositories.lastSynced, cacheThreshold));
}

export async function upsertRepositories(repositoriesData: Omit<Repository, 'createdAt' | 'updatedAt'>[]): Promise<void> {
  for (const repoData of repositoriesData) {
    await db
      .insert(repositories)
      .values({
        ...repoData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: repositories.id,
        set: {
          ...repoData,
          updatedAt: new Date(),
        },
      });
  }
}
