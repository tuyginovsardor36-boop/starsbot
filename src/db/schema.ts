import { pgTable, text, integer, timestamp, boolean, pgEnum, bigint } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('status', ['pending', 'approved', 'cancelled']);
export const orderTypeEnum = pgEnum('type', ['stars', 'premium', 'gift', 'deposit']);

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  balance: integer('balance').default(0),
  bonus: integer('bonus').default(0),
  activity: integer('activity').default(0),
  totalEarned: integer('total_earned').default(0),
  totalWithdrawn: integer('total_withdrawn').default(0),
  referrals: integer('referrals').default(0),
  isBanned: boolean('is_banned').default(false),
  isAdmin: boolean('is_admin').default(false),
  username: text('username'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
  username: text('username'),
  type: orderTypeEnum('type'),
  item: text('item'),
  amount: integer('amount'),
  createdAt: timestamp('created_at').defaultNow(),
  status: orderStatusEnum('status').default('pending'),
});
