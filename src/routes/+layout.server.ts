import type { LayoutServerLoad } from './$types';
import { tags } from '$lib/server/tags';

export const load: LayoutServerLoad = async () => {
	return { tags };
};
