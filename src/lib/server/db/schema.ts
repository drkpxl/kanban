import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cards = sqliteTable('cards', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	board: text('board').notNull(), // 'personal' | 'work'
	column: text('column').notNull(), // 'idea' | 'in_progress' | 'complete'
	position: integer('position').notNull().default(0),
	title: text('title').notNull(),
	body: text('body'), // TipTap JSON string
	hidden: integer('hidden').notNull().default(0), // 0 | 1
	createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
	updatedAt: integer('updated_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000))
});

export const cardTags = sqliteTable('card_tags', {
	cardId: integer('card_id')
		.notNull()
		.references(() => cards.id, { onDelete: 'cascade' }),
	tagSlug: text('tag_slug').notNull()
});

export const images = sqliteTable('images', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	cardId: integer('card_id')
		.notNull()
		.references(() => cards.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000))
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardTag = typeof cardTags.$inferSelect;
export type Image = typeof images.$inferSelect;
