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

test.describe.serial('messaging and follow-up', () => {
  test('patient asks about an exercise from the session; text is shown literally', async ({ page }) => {
    await signIn(page, 'yossi@rehabquest.example');
    await page.goto('/patient/session');
    await page.getByRole('button', { name: /Start session|Continue session/ }).click();
    await page.getByRole('link', { name: 'Ask your therapist about this exercise' }).click();

    await expect(page).toHaveURL(/\/patient\/messages\?context=TASK/);
    await expect(page.getByText('About: Shoulder pendulum', { exact: true })).toBeVisible();
    const unsafe = 'Does this hurt? <img src=x onerror=alert(1)> <b>bold?</b>';
    await page.getByLabel(/Message to/).fill(unsafe);
    await page.getByRole('button', { name: 'Send message' }).click();

    const thread = page.getByRole('list', { name: /Conversation with/ });
    await expect(thread.getByText(unsafe)).toBeVisible();
    await expect(thread.locator('img')).toHaveCount(0);
    await expect(thread.getByRole('link', { name: 'About: Shoulder pendulum' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-patient-messages.png`, fullPage: true });
  });

  test('therapist sees the unanswered question, replies, and the item resolves; unread survives a reload', async ({ page }) => {
    await signIn(page, 'therapist@rehabquest.example');
    const bell = page.getByRole('link', { name: /^Notifications, \d+ unread$/ });
    await expect(bell).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: /^Notifications, \d+ unread$/ })).toBeVisible();

    await page.getByRole('link', { name: 'Reviews' }).click();
    await page.getByRole('button', { name: 'Unanswered message' }).click();
    const item = page.getByRole('article').filter({ hasText: 'Yossi Mizrahi' }).first();
    await expect(item.getByText('Patient message without a reply')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-review-workspace.png`, fullPage: true });
    await item.getByRole('link', { name: 'Reply' }).click();

    await expect(page.getByRole('tab', { name: 'Messages', selected: true })).toBeVisible();
    await expect(page.getByText(/Does this hurt\? <img/)).toBeVisible();
    await page.getByLabel(/Message to/).fill('A light stretch is expected. Stop if it becomes sharp, and tell me.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('A light stretch is expected.', { exact: false })).toBeVisible();

    await page.getByRole('link', { name: 'Reviews' }).click();
    await page.getByRole('button', { name: 'Unanswered message' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Yossi Mizrahi' })).toHaveCount(0);
  });

  test('the patient sees the reply; the unread badge clears only after opening the conversation', async ({ page }) => {
    await signIn(page, 'yossi@rehabquest.example');
    const messagesTab = page.getByRole('link', { name: /^Messages/ }).first();
    await expect(messagesTab.getByLabel(/unread/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: /^Messages/ }).first().getByLabel(/unread/)).toBeVisible();
    await messagesTab.click();
    await expect(page.getByText('A light stretch is expected.', { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: /^Messages/ }).first().getByLabel(/unread/)).toHaveCount(0);
  });

  test('reminder settings persist; push shows an honest unconfigured state', async ({ page }) => {
    await signIn(page, 'maya@rehabquest.example');
    await page.getByRole('link', { name: 'Profile' }).first().click();
    await expect(page.getByLabel('Daily reminder on training days')).toBeChecked();
    await expect(page.getByText('Push is not set up on this server. In-app reminders still work.')).toBeVisible();
    await page.getByLabel('Reminder time').fill('18:30');
    await page.getByRole('button', { name: 'Save reminder settings' }).click();
    await expect(page.getByText('Reminder settings saved')).toBeVisible();
    await page.getByRole('button', { name: '1 hour' }).click();
    await expect(page.getByText(/Snoozed until/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Reminder time')).toHaveValue('18:30');
    await expect(page.getByText(/Snoozed until/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-profile-settings.png`, fullPage: true });
  });

  test('a patient ends a care relationship: read-only history for the patient, no access for the therapist', async ({ page, browser }) => {
    await signIn(page, 'tal@rehabquest.example');
    await page.getByRole('link', { name: 'Profile' }).first().click();
    await page.getByRole('button', { name: 'End care relationship' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End care relationship' }).click();
    await expect(page.getByText('Care relationship ended')).toBeVisible();
    await expect(page.getByText(/^Ended /)).toBeVisible();
    await page.getByRole('link', { name: 'Messages' }).first().click();
    await expect(page.getByText('This care relationship has ended. You can read past messages, but new messages cannot be sent.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Path' }).first().click();
    await expect(page.getByRole('heading', { name: 'Your care relationship has ended' })).toBeVisible();

    const therapistPage = await browser.newPage();
    await signIn(therapistPage, 'therapist2@rehabquest.example');
    await expect(therapistPage.getByText('No patients yet')).toBeVisible();
    await therapistPage.close();
  });
});
