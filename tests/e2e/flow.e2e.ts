import { expect, test, type Page } from '@playwright/test';

/** Drops a generated PNG onto an element the way a browser drag-and-drop would. */
async function dropImage(page: Page, selector: string, name = 'dropped.png') {
	await page.evaluate(
		async ([sel, fileName]) => {
			const canvas = document.createElement('canvas');
			canvas.width = 48;
			canvas.height = 48;
			canvas.getContext('2d')!.fillRect(0, 0, 48, 48);
			const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
			const data = new DataTransfer();
			data.items.add(new File([blob], fileName, { type: 'image/png' }));
			const target = document.querySelector(sel)!;
			for (const type of ['dragenter', 'dragover', 'drop']) {
				target.dispatchEvent(
					new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data })
				);
			}
		},
		[selector, name] as const
	);
}

test('set up, connect a mock account, post a thread', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);

	await page.getByLabel('Username').fill('e2e');
	await page.getByLabel('Password', { exact: true }).fill('e2e-password-123');
	await page.getByLabel('Confirm password').fill('e2e-password-123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/accounts/);

	await page.getByRole('link', { name: 'Connect account' }).first().click();
	await expect(page.getByText('@mock_user_1')).toBeVisible();

	await page.goto('/compose');
	await expect(page.getByRole('button', { name: 'Post as @mock_user_1' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	const first = page.getByPlaceholder("What's happening?");
	await first.fill('Hello from the end-to-end test ');

	// Drag-and-drop upload onto the post box.
	await dropImage(page, 'textarea');
	const alt = page.getByLabel('Alt text for dropped.png');
	await expect(alt).toBeVisible();
	await alt.fill('A black square');

	// Bundled emoji picker inserts at the caret.
	await first.click();
	await first.press('End');
	await page.getByRole('button', { name: 'Add emoji' }).click();
	await page.locator('emoji-picker [role="menuitem"]').first().click();
	await expect(first).toHaveValue(/^Hello from the end-to-end test \p{Extended_Pictographic}/u);

	await page.getByRole('button', { name: 'Add another post' }).click();
	await page
		.getByPlaceholder('Add to the thread')
		.fill('Second post with a link https://example.com');
	await expect(page.getByText('Contains a link')).toBeVisible();
	// 1 post + 1 post with a link + 1 image description
	await expect(page.getByText('$0.220')).toBeVisible();
	await page.getByRole('button', { name: 'Post thread now' }).click();
	await expect(page).toHaveURL(/\/$/);

	await expect(async () => {
		await page.goto('/history');
		await expect(page.getByText('Hello from the end-to-end test')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 20_000 });
	await expect(page.getByText('Thread of 2')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open on X' })).toBeVisible();
});

/** Signs in, or creates the owner and a mock account when this test runs on its own. */
async function signIn(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('e2e');
	await page.getByLabel('Password', { exact: true }).fill('e2e-password-123');
	if (page.url().includes('/setup')) {
		await page.getByLabel('Confirm password').fill('e2e-password-123');
		await page.getByRole('button', { name: 'Create account' }).click();
		await page.getByRole('link', { name: 'Connect account' }).first().click();
		await expect(page.getByText('@mock_user_1')).toBeVisible();
	} else {
		await page.getByRole('button', { name: 'Sign in' }).click();
	}
	await expect(page).not.toHaveURL(/\/(login|setup)/);
}

const altInputs = (page: Page) => page.locator('input[aria-label^="Alt text for"]');

/**
 * Touch gesture from the centre of `from` to the centre of `to`. With `holdMs` the finger rests
 * first (a drag); without it the finger moves at once (a scroll). Playwright has no touch-move
 * API, so the events are built in the page.
 */
async function touchDrag(page: Page, from: string, to: string, holdMs: number) {
	await page.evaluate(
		async ([fromSel, toSel, hold]) => {
			const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
			const centre = (el: Element) => {
				const r = el.getBoundingClientRect();
				return [r.left + r.width / 2, r.top + Math.min(r.height, r.width) / 2];
			};
			const start = document.querySelector(fromSel)!;
			const [x0, y0] = centre(start);
			const [x1, y1] = centre(document.querySelector(toSel)!);
			const fire = (type: string, target: Element, x: number, y: number) => {
				const t = new Touch({ identifier: 1, target, clientX: x, clientY: y });
				const live = type === 'touchend' ? [] : [t];
				target.dispatchEvent(
					new TouchEvent(type, {
						bubbles: true,
						cancelable: true,
						touches: live,
						targetTouches: live,
						changedTouches: [t]
					})
				);
			};
			fire('touchstart', start, x0, y0);
			await sleep(hold);
			for (let i = 1; i <= 15; i++) {
				const x = x0 + ((x1 - x0) * i) / 15;
				const y = y0 + ((y1 - y0) * i) / 15;
				fire('touchmove', document.elementFromPoint(x, y) ?? start, x, y);
				await sleep(30);
			}
			fire('touchend', document.elementFromPoint(x1, y1) ?? start, x1, y1);
			await sleep(400);
		},
		[from, to, holdMs] as const
	);
}

test('media library accepts dropped files', async ({ page }) => {
	await signIn(page);
	// Let the page hydrate first, or the synthetic drop lands before the drop handler exists.
	await page.goto('/library', { waitUntil: 'networkidle' });
	await dropImage(page, '[aria-label^="Upload media"]', 'library-drop.png');
	await expect(page.getByText('Uploaded 1 file')).toBeVisible();
	await expect(page.getByLabel('Description for library-drop.png')).toBeVisible();
});

test('composer reorders media by dragging and warns about repeated text', async ({ page }) => {
	await signIn(page);
	await page.goto('/compose', { waitUntil: 'networkidle' });
	await page.getByPlaceholder("What's happening?").fill('Repeat after me');
	await dropImage(page, 'textarea', 'first.png');
	await expect(page.getByLabel('Alt text for first.png')).toBeVisible();
	await dropImage(page, 'textarea', 'second.png');
	await expect(page.getByLabel('Alt text for second.png')).toBeVisible();
	await expect(altInputs(page).first()).toHaveAttribute('aria-label', 'Alt text for first.png');

	// Drag the second tile onto the first with a real mouse gesture.
	const tiles = page.locator('figure[aria-label]');
	const from = (await tiles.nth(1).boundingBox())!;
	const to = (await tiles.nth(0).boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.width / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 3, to.y + to.width / 2, { steps: 12 });
	await page.mouse.up();
	await expect(altInputs(page).first()).toHaveAttribute('aria-label', 'Alt text for second.png');
	await expect(page.getByLabel('second.png, 1 of 2')).toBeVisible();

	await altInputs(page).nth(0).fill('Second square');
	await altInputs(page).nth(1).fill('First square');
	await page.getByRole('button', { name: 'Post now' }).click();
	await expect(page).toHaveURL(/\/$/);

	// Same words again: the composer asks before sending something X would turn down.
	await page.goto('/compose');
	await page.getByPlaceholder("What's happening?").fill('repeat   after ME');
	await page.getByRole('button', { name: 'Post now' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('You already have a post with this text')).toBeVisible();
	await expect(dialog.getByText('Repeat after me')).toBeVisible();
	await dialog.getByRole('button', { name: 'Edit text' }).click();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/compose/);
});

test('calendar: list view, day panel, and undoing a delete', async ({ page }) => {
	await signIn(page);
	const when = new Date();
	when.setDate(when.getDate() + 1);
	when.setHours(10, 0, 0, 0);
	const day = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;

	await page.goto(`/compose?at=${when.getTime()}`);
	await page.getByPlaceholder("What's happening?").fill('Calendar e2e post');
	await page.getByRole('button', { name: 'Schedule', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);

	// List view used to 500 as soon as it had a post to show.
	const list = await page.goto('/calendar?view=list');
	expect(list?.status()).toBe(200);
	await page.getByRole('button', { name: 'Select post' }).first().click();
	await expect(page.getByText('1 selected')).toBeVisible();

	// Clicking a day opens its posts in the panel.
	await page.goto('/calendar');
	await page.locator(`.sx__month-grid-day[data-date="${day}"]`).click();
	const panel = page.getByRole('dialog');
	await expect(panel.getByText('Calendar e2e post')).toBeVisible();

	// Delete, then Undo: the post comes back and nothing is sent.
	await panel.getByRole('button', { name: 'Delete post' }).click();
	await expect(panel.getByText('Calendar e2e post')).toBeHidden();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(panel.getByText('Calendar e2e post')).toBeVisible();

	// Delete for real once the undo window passes.
	await panel.getByRole('button', { name: 'Delete post' }).click();
	await page.waitForTimeout(6_000);
	await page.goto('/calendar?view=list');
	await expect(page.getByText('Calendar e2e post')).toBeHidden();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

	test('a swipe over photos scrolls; press and hold drags them', async ({ page }) => {
		await signIn(page);
		await page.goto('/compose', { waitUntil: 'networkidle' });
		await page.getByPlaceholder("What's happening?").fill('Touch reorder');
		await dropImage(page, 'textarea', 'one.png');
		await expect(page.getByLabel('Alt text for one.png')).toBeVisible();
		await dropImage(page, 'textarea', 'two.png');
		await expect(page.getByLabel('Alt text for two.png')).toBeVisible();

		const two = 'figure[aria-label^="two.png"] img';
		const one = 'figure[aria-label^="one.png"] img';
		await touchDrag(page, two, one, 0);
		await expect(altInputs(page).first()).toHaveAttribute('aria-label', 'Alt text for one.png');

		await touchDrag(page, two, one, 300);
		await expect(altInputs(page).first()).toHaveAttribute('aria-label', 'Alt text for two.png');
	});

	test('queue order follows a drag on the grip', async ({ page }) => {
		await signIn(page);
		await page.goto('/queue', { waitUntil: 'networkidle' });
		if (!(await page.locator('input[type="time"]').count())) {
			await page.getByRole('button', { name: 'Add a time' }).click();
			await page.getByRole('button', { name: 'Save times' }).click();
			await expect(page.getByText('Queue times saved')).toBeVisible();
		}
		for (const text of ['Queue touch A', 'Queue touch B']) {
			await page.goto('/compose', { waitUntil: 'networkidle' });
			await page.getByPlaceholder("What's happening?").fill(text);
			await page.getByRole('button', { name: 'More actions' }).click();
			await page.getByRole('menuitem', { name: /Add to queue/ }).click();
			await expect(page).toHaveURL(/\/queue/);
		}
		const rows = page.getByRole('list', { name: 'Queue order' }).getByRole('listitem');
		const index = async (text: string) =>
			(await rows.allInnerTexts()).findIndex((t) => t.includes(text));
		expect(await index('Queue touch A')).toBeLessThan(await index('Queue touch B'));

		await touchDrag(
			page,
			'li[aria-label="Queue touch B"] [aria-label="Drag to reorder"]',
			'li[aria-label="Queue touch A"]',
			0
		);
		await expect(async () => {
			expect(await index('Queue touch B')).toBeLessThan(await index('Queue touch A'));
		}).toPass();
		await page.reload();
		expect(await index('Queue touch B')).toBeLessThan(await index('Queue touch A'));
	});
});
