import { db } from '$lib/server/db/index';
import { tags as tagsTable } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export interface Tag {
	slug: string;
	label: string;
	color: string;
}

export async function getTags(): Promise<Tag[]> {
	return db
		.select({ slug: tagsTable.slug, label: tagsTable.label, color: tagsTable.color })
		.from(tagsTable)
		.orderBy(asc(tagsTable.createdAt));
}
