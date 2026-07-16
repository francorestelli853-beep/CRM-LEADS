import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  segment: text("segment").notNull().default("General"),
  owner: text("owner").notNull(),
  status: text("status").notNull().default("Pendiente"),
  priority: text("priority").notNull().default("Media"),
  batch: text("batch").notNull().default(""),
  notes: text("notes").notNull().default(""),
  nextFollowUp: text("next_follow_up"),
  source: text("source").notNull().default("Manual"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  type: text("type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actor: text("actor").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const messageTemplates = sqliteTable("message_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  stage: text("stage").notNull(),
  body: text("body").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});
