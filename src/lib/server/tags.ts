import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface Tag {
	slug: string;
	label: string;
	color: string;
}

interface TagsFile {
	tags: Tag[];
}

function loadTags(): Tag[] {
	try {
		const raw = readFileSync(join(process.cwd(), 'tags.yaml'), 'utf-8');
		const parsed = yaml.load(raw) as TagsFile;
		return parsed?.tags ?? [];
	} catch {
		return [];
	}
}

export const tags: Tag[] = loadTags();
