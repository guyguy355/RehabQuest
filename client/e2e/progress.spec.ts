import { expect, type Page, test } from '@playwright/test';

const PASSWORD = 'Demo1234!';
const SHOTS = 'test-results/screens';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.serial('goals, check-ins, trends, motivation and education', () => {
  test('patient sees goals with measurement progress and sends a partial weekly check-in', async ({ page }) => {
    await signIn(page, 'maya@rehabquest.example');
    await expect(page.getByRole('heading', { name: 'This week’s goal' })).toBeVisible();
    await page.getByRole('link', { name: 'Progress' }).first().click();

    const goal = page.getByRole('article', { name: 'Bend the knee enough to ride a bike again' });
    await expect(goal.getByText(/Latest: 118 ° on .* · start: 95 °/)).toBeVisible();
    await expect(goal.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText('Milestones: 1 of 3 reached')).toBeVisible();

    const checkIn = page.getByRole('region', { name: 'Weekly check-in' });
    await checkIn.getByRole('group', { name: /Typical pain this week/ }).getByLabel('2', { exact: true }).check({ force: true });
    await checkIn.getByRole('button', { name: 'Send check-in' }).click();
    await expect(page.getByText('Check-in sent')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-progress-goals.png`, fullPage: true });

    await page.reload();
    await expect(checkIn.getByText('Sent. You can change your answers until the end of next week.')).toBeVisible();
    await expect(checkIn.getByRole('group', { name: /Typical pain this week/ }).getByLabel('2', { exact: true })).toBeChecked();
    await expect(checkIn.getByRole('group', { name: /Worst pain this week/ }).getByRole('radio', { checked: true })).toHaveCount(0);
  });

  test('trends: charts and an equivalent table, with missing data shown as such', async ({ page }) => {
    await signIn(page, 'maya@rehabquest.example');
    await page.goto('/patient/progress?tab=trends');
    await expect(page.getByRole('img', { name: /Bar chart of the share of due sessions/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Line chart of the average reported pain/ })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-progress-trends.png`, fullPage: true });

    const firstBar = page.getByRole('button', { name: /^Week of .*: No plan this week$/ }).first();
    await firstBar.focus();
    await expect(page.getByRole('status').filter({ hasText: 'No plan this week' })).toBeVisible();

    await page.getByRole('button', { name: 'Table' }).click();
    const table = page.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(13); // header + 12 weeks
    await expect(table.getByText('No plan this week').first()).toBeVisible();
    await expect(table.getByText('No check-in').first()).toBeVisible();
    await expect(table.getByText('No answer').first()).toBeVisible(); // the blank question in last week's check-in
  });

  test('achievements explain their rule; an unlocked look can be chosen and stays after reload', async ({ page }) => {
    await signIn(page, 'maya@rehabquest.example');
    await page.goto('/patient/progress?tab=achievements');
    await expect(page.getByText('How to earn it:').first()).toBeVisible();
    await expect(page.getByText('Reach your weekly session goal in 4 different weeks. They do not need to be in a row.')).toBeVisible();
    const cap = page.getByRole('button', { name: /Blue cap/ });
    await cap.click();
    await expect(page.getByText('Pip’s look changed')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /Blue cap/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Finisher medal/ })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/desktop-progress-achievements.png`, fullPage: true });
  });

  test('education: an updated card asks to be read again; the therapist sees the read state', async ({ page, browser }) => {
    await signIn(page, 'maya@rehabquest.example');
    await page.getByRole('link', { name: /2 cards from your therapist to read/ }).click();
    const card = page.getByRole('article', { name: 'Why some soreness after exercise is expected' });
    await expect(card.getByText('Updated since you read it')).toBeVisible();
    await expect(card.getByRole('listitem').filter({ hasText: 'Sharp pain, swelling' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-learn.png`, fullPage: true });
    await card.getByRole('button', { name: 'I have read the update' }).click();
    await expect(card.getByText(/You confirmed reading this version on/)).toBeVisible();

    const therapist = await browser.newPage();
    await signIn(therapist, 'therapist@rehabquest.example');
    await therapist.getByRole('link', { name: /Maya Levi/ }).first().click();
    await therapist.getByRole('tab', { name: 'Education' }).click();
    const row = therapist.getByRole('listitem').filter({ hasText: 'Why some soreness after exercise is expected' });
    await expect(row.getByText('Read', { exact: true })).toBeVisible();
    await expect(row.getByText(/Last confirmed: version 2/)).toBeVisible();
    await therapist.close();
  });

  test('therapist confirms a milestone, reads check-in notes, and publishes a new card version', async ({ page }) => {
    await signIn(page, 'therapist@rehabquest.example');
    await page.getByRole('link', { name: /Maya Levi/ }).first().click();

    await page.getByRole('tab', { name: 'Goals' }).click();
    const stairs = page.getByRole('article', { name: 'Climb the stairs at home without holding the rail' });
    await stairs.getByRole('listitem').filter({ hasText: 'with one hand on the rail' }).getByRole('button', { name: 'Confirm reached' }).click();
    await expect(page.getByText('Milestone confirmed')).toBeVisible();
    await expect(stairs.getByText('Milestones: 2 of 3 reached')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-therapist-goals.png`, fullPage: true });

    await page.getByRole('tab', { name: 'Trends' }).click();
    await expect(page.getByText('“Stairs are still hard in the evening.”')).toBeVisible();

    await page.getByRole('link', { name: 'Education cards' }).click();
    const ice = page.getByRole('listitem').filter({ hasText: 'Using ice after your session' });
    await ice.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reading time (minutes)').fill('2');
    await dialog.getByRole('button', { name: 'Preview as the patient' }).click();
    await expect(dialog.getByText('Wrap it in a thin towel; never put ice directly on the skin.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish new version' }).click();
    await expect(page.getByText('New version published')).toBeVisible();
    await expect(ice.getByText('Version 2')).toBeVisible();
  });

  test('calm mode is saved to the account and follows the user to a new session', async ({ page, browser }) => {
    await signIn(page, 'yossi@rehabquest.example');
    await page.getByRole('link', { name: 'Profile' }).first().click();
    const calm = page.getByRole('checkbox', { name: /Calm mode/ });
    await expect(calm).not.toBeChecked();
    await calm.check();
    await expect(page.locator('html')).toHaveClass(/calm/);

    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await signIn(other, 'yossi@rehabquest.example');
    await expect(other.locator('html')).toHaveClass(/calm/);
    await fresh.close();
  });
});
