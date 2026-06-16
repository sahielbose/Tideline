/**
 * Service layer barrel (CONTEXT.md §12). Routes, server actions, and jobs import
 * from here; they never touch the database or vendors directly.
 */
export * from "./audit";
export * from "./notifications";
export * from "./ingestion";
export * from "./metrics";
export * from "./insights";
export * from "./labs";
export * from "./medications";
export * from "./chat";
export * from "./reviews";
export * from "./timeline";
export * from "./account";
export * from "./dashboard";
export * from "./health-index";
export * from "./plan";
export * from "./readiness";
export * from "./body-systems";
export * from "./risk";
export * from "./care-gaps";
export { detectDrift } from "./drift";
