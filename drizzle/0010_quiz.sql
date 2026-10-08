CREATE TABLE "quiz" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plays_on" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"join_token" text NOT NULL,
	"seconds_per_question" integer DEFAULT 8 NOT NULL,
	"current_position" integer DEFAULT 0 NOT NULL,
	"question_started_at" timestamp with time zone,
	"question_ended_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_join_token_unique" UNIQUE("join_token")
);
--> statement-breakpoint
CREATE TABLE "quiz_answer" (
	"question_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"option_index" integer NOT NULL,
	"correct" boolean NOT NULL,
	"ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_question_id_participant_id_pk" PRIMARY KEY("question_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL,
	"name" text NOT NULL,
	"member_id" text,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_participant_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "quiz_question" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_created_by_id_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_participant_id_quiz_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."quiz_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant" ADD CONSTRAINT "quiz_participant_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_participant" ADD CONSTRAINT "quiz_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_plays_on_idx" ON "quiz" USING btree ("plays_on");--> statement-breakpoint
CREATE INDEX "quiz_answer_participant_idx" ON "quiz_answer" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "quiz_participant_quiz_idx" ON "quiz_participant" USING btree ("quiz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_participant_name_unique" ON "quiz_participant" USING btree ("quiz_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_participant_member_unique" ON "quiz_participant" USING btree ("quiz_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_question_position_unique" ON "quiz_question" USING btree ("quiz_id","position");