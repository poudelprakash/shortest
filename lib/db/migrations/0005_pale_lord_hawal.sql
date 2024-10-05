CREATE TABLE IF NOT EXISTS "repositories" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"last_synced" timestamp NOT NULL,
	"maintainability" integer,
	"test_coverage" integer,
	"monitored_branches" varchar[] NOT NULL,
	"last_commit" timestamp NOT NULL,
	"user_role" varchar NOT NULL,
	"open_pull_requests" integer NOT NULL,
	"provider" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
