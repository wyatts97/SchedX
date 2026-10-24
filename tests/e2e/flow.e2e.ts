import { expect, test, type Page } from '@playwright/test';

/** Drops a generated PNG onto an element the way a browser drag-and-drop would. */
async function dropImage(page: Page, selector: string) {
	await page.evaluate(async (sel) => {
		const canvas = document.createElement('canvas');
		canvas.width = 48;
		canvas.height = 48;
		canvas.getContext('2d')!.fillRect(0, 0, 48, 48);
		const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
		const data = new DataTransfer();
		data.items.add(new File([blob], 'dropped.png', { type: 'image/png' }));
		const target = document.querySelector(sel)!;
		for (const type of ['dragenter', 'dragover', 'drop']) {
			target.dispatchEvent(
				new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data })
			);
		}
	}, selector);
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

test('media library accepts dropped files', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('e2e');
	await page.getByLabel('Password').fill('e2e-password-123');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/$/);

	await page.goto('/library');
	await dropImage(page, '[aria-label^="Upload media"]');
	await expect(page.getByText('Uploaded 1 file')).toBeVisible();
	await expect(page.getByLabel('Description for dropped.png')).toBeVisible();
});
