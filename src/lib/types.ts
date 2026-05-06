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
