CREATE TABLE "github_access" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"token_sealed" text NOT NULL,
	"token_last4" text NOT NULL,
	"login" text NOT NULL,
	"set_by_email" text NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_access_singleton" CHECK ("github_access"."singleton")
);
