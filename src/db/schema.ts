import { pgTable, text, timestamp, boolean, integer, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Using text for UUID/IDs
  name: text('name').notNull(),
  email: text('email'),
  points: integer('points').default(0),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const circles = pgTable('circles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').unique().notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userCircles = pgTable('user_circles', {
  userId: text('user_id').references(() => users.id).notNull(),
  circleId: text('circle_id').references(() => circles.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.circleId] }),
}));

export const habitLogs = pgTable('habit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  habitId: text('habit_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  completed: boolean('completed').default(false),
  count: integer('count').default(0),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const favoriteDuas = pgTable('favorite_duas', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
