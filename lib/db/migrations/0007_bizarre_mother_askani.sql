CREATE TABLE IF NOT EXISTS "repository_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" varchar NOT NULL,
	"test_frameworks" jsonb NOT NULL,
	"test_folder_patterns" jsonb NOT NULL,
	"test_file_naming_convention" jsonb NOT NULL,
	"coverage_folder_path" varchar,
	"user_test_folder_preference" jsonb,
	"test_type_handling" jsonb,
	"feature_domain_based_test" boolean DEFAULT false,
	"external_test_repo" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repository_configs" ADD CONSTRAINT "repository_configs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
