import { pgTable, text, integer, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('status', ['pending', 'approved', 'cancelled']);
export const orderTypeEnum = pgEnum('type', ['stars', 'premium', 'gift', 'deposit']);

export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  balance: integer('balance').default(0),
  bonus: integer('bonus').default(0),
  activity: integer('activity').default(0),
  totalEarned: integer('total_earned').default(0),
  totalWithdrawn: integer('total_withdrawn').default(0),
  referrals: integer('referrals').default(0),
  isBanned: boolean('is_banned').default(false),
  username: text('username'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  username: text('username'),
  type: orderTypeEnum('type'),
  item: text('item'),
  amount: integer('amount'),
  createdAt: timestamp('created_at').defaultNow(),
  status: orderStatusEnum('status').default('pending'),
});
