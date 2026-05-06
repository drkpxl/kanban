import { on } from 'svelte/events';

export interface SwipeableParams {
	enabled?: boolean;
	onLeft?: () => void;
	onRight?: () => void;
	threshold?: number;
}

export function swipeable(node: HTMLElement, params: SwipeableParams = {}) {
	let { enabled = true, onLeft, onRight, threshold = 55 } = params;

	let startX = 0;
	let startY = 0;
	let lastY = 0;
	let tracking = false;
	let scrolling = false;
	let cancelDispatched = false;
	let scrollEl: HTMLElement | null = null;

	function touchstart(e: TouchEvent) {
		if (!enabled || e.touches.length !== 1) return;
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		lastY = startY;
		tracking = true;
		scrolling = false;
		cancelDispatched = false;
		scrollEl = node.closest('.card-list');
		node.dataset.swiping = '1';
		node.style.transition = 'none';
		node.dispatchEvent(
			new CustomEvent('cardswipestart', {
				bubbles: true,
				detail: { cardId: node.dataset.cardId }
			})
		);
	}

	function touchmove(e: TouchEvent) {
		if (!enabled || e.touches.length !== 1) return;
		const curX = e.touches[0].clientX;
		const curY = e.touches[0].clientY;

		if (scrolling) {
			scrollEl?.scrollBy(0, lastY - curY);
			lastY = curY;
			return;
		}

		if (!tracking) return;

		const dx = curX - startX;
		const dy = curY - startY;
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		if (absDy > absDx && absDy > 10) {
			tracking = false;
			scrolling = true;
			node.style.transition = '';
			node.style.transform = '';
			scrollEl?.scrollBy(0, lastY - curY);
			lastY = curY;
			node.dispatchEvent(new CustomEvent('cardswipeend', { bubbles: true }));
			return;
		}

		if (absDx > absDy && absDx > 5) {
			if (absDx > 10 && !cancelDispatched) {
				cancelDispatched = true;
				node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true }));
			}
			node.style.transform = `translateX(${dx * 0.28}px)`;
			const zone = dx > 25 ? 'right' : dx < -25 ? 'left' : null;
			node.dispatchEvent(new CustomEvent('cardswipemove', { bubbles: true, detail: { zone } }));
		}

		lastY = curY;
	}

	function touchend(e: TouchEvent) {
		const wasTracking = tracking;
		tracking = false;
		scrolling = false;
		cancelDispatched = false;
		delete node.dataset.swiping;

		node.style.transition = '';
		node.style.transform = '';
		node.dispatchEvent(new CustomEvent('cardswipeend', { bubbles: true }));

		if (!enabled || !wasTracking) return;

		const dx = e.changedTouches[0].clientX - startX;
		const dy = e.changedTouches[0].clientY - startY;

		if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.1) {
			if (dx > 0) onRight?.();
			else onLeft?.();
		}
	}

	const offs = [
		on(node, 'touchstart', touchstart as EventListener, { passive: true }),
		on(node, 'touchmove', touchmove as EventListener, { passive: true }),
		on(node, 'touchend', touchend as EventListener, { passive: true }),
		on(node, 'touchcancel', touchend as EventListener, { passive: true })
	];

	return {
		update(newParams: SwipeableParams) {
			enabled = newParams.enabled ?? true;
			onLeft = newParams.onLeft;
			onRight = newParams.onRight;
			threshold = newParams.threshold ?? 55;
		},
		destroy() {
			offs.forEach((off) => off());
		}
	};
}
