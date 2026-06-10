import type { LayoutServerLoad } from './$types';
import { getTags } from '$lib/server/tags';

export const load: LayoutServerLoad = async () => {
	return { tags: await getTags() };
};
