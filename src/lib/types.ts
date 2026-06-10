export interface BookmarkData {
	id: number;
	url: string;
	title: string;
	description: string | null;
	favicon: string | null;
	position: number;
	tags: string[];
	createdAt: number;
}

export interface CardData {
	id: number;
	title: string;
	body: string | null;
	tags: string[];
	column: string;
	hidden: number;
	position: number;
	board: string;
}
