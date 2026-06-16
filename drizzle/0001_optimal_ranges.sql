ALTER TABLE "lab_markers" ADD COLUMN "optimal_low" double precision;--> statement-breakpoint
ALTER TABLE "lab_markers" ADD COLUMN "optimal_high" double precision;--> statement-breakpoint
ALTER TABLE "reference_ranges" ADD COLUMN "optimal_low" double precision;--> statement-breakpoint
ALTER TABLE "reference_ranges" ADD COLUMN "optimal_high" double precision;