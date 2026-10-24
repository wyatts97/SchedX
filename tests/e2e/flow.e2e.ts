import { expect, test } from '@playwright/test';

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
	await page.getByPlaceholder("What's happening?").fill('Hello from the end-to-end test');
	await page.getByRole('button', { name: 'Add another post' }).click();
	await page
		.getByPlaceholder('Add to the thread')
		.fill('Second post with a link https://example.com');
	await expect(page.getByText('Contains a link')).toBeVisible();
	await expect(page.getByText('$0.215')).toBeVisible();
	await page.getByRole('button', { name: 'Post thread now' }).click();
	await expect(page).toHaveURL(/\/$/);

	await expect(async () => {
		await page.goto('/history');
		await expect(page.getByText('Hello from the end-to-end test')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 20_000 });
	await expect(page.getByText('Thread of 2')).toBeVisible();
});
