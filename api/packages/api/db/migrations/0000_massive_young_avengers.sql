CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"completion_time" integer NOT NULL,
	"solved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_player_game_unique" UNIQUE("player_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_claim_code_unique" UNIQUE("claim_code")
);
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_solved_at_idx" ON "game_sessions" USING btree ("solved_at");