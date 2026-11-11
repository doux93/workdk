import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const agentEvents = sqliteTable(
  "agent_events",
  {
    id: text("id").primaryKey().notNull(),
    sessionKey: text("session_key").notNull(),
    device: text("device").notNull(),
    source: text("source").notNull(),
    project: text("project").notNull(),
    session: text("session").notNull(),
    kind: text("kind").notNull(),
    at: text("at").notNull(),
    summary: text("summary").notNull(),
    evidence: text("evidence").notNull(),
    receivedAt: text("received_at").notNull(),
  },
  (table) => [
    index("agent_session_at").on(table.sessionKey, table.at),
    index("agent_event_at").on(table.at),
  ],
);
export const agentAnnotations = sqliteTable("agent_annotations", {
  sessionKey: text("session_key").primaryKey().notNull(),
  title: text("title").notNull().default(""),
  summary: text("summary").notNull().default(""),
  project: text("project").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
