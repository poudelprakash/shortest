import {
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: varchar("clerk_id", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripeProductId: varchar("stripe_product_id", { length: 255 }),
    planName: varchar("plan_name", { length: 100 }),
    subscriptionStatus: varchar("subscription_status", { length: 20 }),
    name: varchar("name", { length: 100 }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (users) => ({
    uniqueClerkId: uniqueIndex("unique_clerk_id").on(users.clerkId),
  })
);

export const pullRequests = pgTable(
  "pull_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    githubId: integer("github_id").notNull(),
    number: integer("number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    owner: varchar("owner", { length: 255 }).notNull(),
    repo: varchar("repo", { length: 255 }).notNull(),
  },
  (table) => ({
    userGithubIdIdx: uniqueIndex("user_github_id_idx").on(
      table.userId,
      table.githubId
    ),
  })
);

export const repositories = pgTable('repositories', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  fullPath: varchar('fullPath').notNull(),
  lastSynced: timestamp('last_synced').notNull(),
  maintainability: integer('maintainability'),
  testCoverage: integer('test_coverage'),
  monitoredBranches: varchar('monitored_branches').array().notNull(),
  lastCommit: timestamp('last_commit').notNull(),
  userRole: varchar('user_role').notNull(),
  openPullRequests: integer('open_pull_requests').notNull(),
  provider: varchar('provider').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const repositoryConfigs = pgTable('repository_configs', {
  id: serial('id').primaryKey(),
  repositoryId: varchar('repository_id').references(() => repositories.id).notNull(), // Foreign key to 'repositories'
  testFrameworks: jsonb('test_frameworks').notNull(),      // List of test frameworks used
  testFolderPatterns: jsonb('test_folder_patterns').notNull(),   // Patterns for test folder locations
  testFileNamingConvention: jsonb('test_file_naming_convention').notNull(), // Test file naming conventions
  coverageFolderPath: varchar('coverage_folder_path'),     // Path for test coverage results
  userTestFolderPreference: jsonb('user_test_folder_preference'), // User preference for test location
  testTypeHandling: jsonb('test_type_handling'),           // Handling rules for different test types
  featureDomainBasedTest: boolean('feature_domain_based_test').default(false), // Domain/feature-based test structure
  externalTestRepo: varchar('external_test_repo'),         // External test repo path if applicable
  createdAt: timestamp('created_at').defaultNow().notNull(), // Auto-timestamp for creation
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Auto-timestamp for updates
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PullRequest = typeof pullRequests.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;

export interface ExtendedPullRequest extends PullRequest {
  repository: {
    owner: string;
    repo: string;
  };
}
