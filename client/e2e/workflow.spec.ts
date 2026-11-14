import { expect, type Page, test } from '@playwright/test';

const PASSWORD = 'Demo1234!';
const SHOTS = 'test-results/screens';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function choosePain(page: Page, level: number) {
  await page.getByRole('radio', { name: new RegExp(`^${level}( –|$)`) }).check({ force: true });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test.describe.serial('core workflow', () => {
  test('guided session: overview, pause, refresh, timers, four outcomes, confirmed rewards', async ({ page }) => {
    await page.clock.install();
    await signIn(page, 'maya@rehabquest.example');
    await expect(page.getByRole('heading', { name: /session is ready/i })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-patient-home.png` });
    const xpBefore = Number(await page.getByTitle('XP earned for planned exercises').locator('.tabular').innerText());

    await page.getByRole('link', { name: 'Start session' }).click();
    await expect(page.getByRole('heading', { name: "Today's exercises" })).toBeVisible();
    await expect(page.getByText(/Estimated time: about \d+ min/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-session-overview.png` });
    await page.getByRole('button', { name: 'Start session' }).click();

    // Exercise 1: tick both sets, pause, refresh → restored paused with ticks kept.
    await expect(page.getByRole('heading', { name: 'Heel slides' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark set done' }).first().click();
    await page.getByRole('button', { name: 'Mark set done' }).first().click();
    await expect(page.getByRole('button', { name: 'Set done' })).toHaveCount(2);
    await page.clock.fastForward(30_000);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Session paused. Paused time is not counted.')).toBeVisible();
    const activeAtPause = await page.getByTitle('Active time, pauses not counted').innerText();
    await page.clock.fastForward(120_000); // paused time must not be counted
    await expect(page.getByTitle('Active time, pauses not counted')).toHaveText(activeAtPause);

    await page.reload();
    await expect(page.getByText('Welcome back. Your session was kept and is paused.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set done' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Resume' }).first().click();
    await page.getByRole('button', { name: 'I’m done with this exercise' }).click();
    await expect(page.getByRole('radio', { name: /I did all prescribed sets/ })).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).click();
    await choosePain(page, 2);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('1/4')).toBeVisible();

    // Exercise 2: a hold timer runs out → nothing is recorded; then record a partial.
    await expect(page.getByRole('heading', { name: 'Quad sets' })).toBeVisible();
    await page.getByRole('button', { name: /^Hold 5 s$/ }).first().click();
    await expect(page.getByRole('region', { name: 'Timer' })).toBeVisible();
    await page.clock.fastForward(6_000);
    await expect(page.getByText('Time is up. Tick the set yourself when you are done.')).toBeVisible();
    await expect(page.getByText('1/4')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-session-timer.png` });
    await page.getByRole('button', { name: 'Close timer' }).click();
    await page.getByRole('button', { name: 'Mark set done' }).first().click();
    await page.getByRole('button', { name: 'I’m done with this exercise' }).click();
    await expect(page.getByRole('radio', { name: /I did part of it/ })).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).click();
    await choosePain(page, 3);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('2/4')).toBeVisible();

    // Exercise 3: skip with a reason (pain optional).
    await page.getByRole('button', { name: 'Skip this exercise' }).click();
    await expect(page.getByRole('heading', { name: 'Skipping is okay' })).toBeVisible();
    await page.getByRole('radio', { name: 'No time' }).check({ force: true });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('3/4')).toBeVisible();

    // Exercise 4: the persistent stop action.
    await page.getByRole('button', { name: 'Stop – discomfort' }).click();
    await expect(page.getByRole('heading', { name: 'Stopping was the right call' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and tell my therapist' }).click();
    await expect(page.getByText('Choose a number from 0 to 10')).toBeVisible();
    await choosePain(page, 6);
    await page.getByLabel('What happened? (optional)').fill('Knee felt unstable on the last set.');
    await page.screenshot({ path: `${SHOTS}/desktop-session-stop.png` });
    await page.getByRole('button', { name: 'Save and tell my therapist' }).click();

    await expect(page).toHaveURL(/\/patient\/session\/complete$/);
    await expect(page.getByRole('heading', { name: 'Session complete!' })).toBeVisible();
    const recorded = page.getByRole('region', { name: 'What you recorded' }).getByRole('listitem');
    await expect(recorded).toHaveCount(4);
    // 10 (completed) + 5 (partial) + 0 (skipped) + 0 (stopped) + 20 session bonus
    await expect(page.getByText('XP confirmed').locator('..')).toContainText('35');
    await page.screenshot({ path: `${SHOTS}/desktop-session-complete.png`, fullPage: true });

    await page.getByRole('link', { name: 'Back to my path' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: /session is done/i })).toBeVisible();
    const xpAfter = Number(await page.getByTitle('XP earned for planned exercises').locator('.tabular').innerText());
    expect(xpAfter - xpBefore).toBe(35);
  });

  test('therapist creates a plan from a template, previews it as the patient, and publishes it', async ({ page }) => {
    await signIn(page, 'therapist@rehabquest.example');
    await page.getByRole('button', { name: 'Add patient' }).click();
    await page.getByLabel('Patient email').fill('noa@rehabquest.example');
    await page.getByLabel('Care code').fill('00000000');
    await page.getByRole('dialog').getByRole('button', { name: 'Add patient' }).click();
    await expect(page.getByText(/No patient matches that email and care code/)).toBeVisible();
    await page.getByLabel('Care code').fill('C0FFEE42');
    await page.getByRole('dialog').getByRole('button', { name: 'Add patient' }).click();
    await expect(page.getByText('Noa Friedman was added to your patients')).toBeVisible();

    await page.getByRole('link', { name: /Noa Friedman/ }).click();
    await page.getByRole('tab', { name: 'Plan' }).click();
    await page.getByRole('link', { name: 'Create the first plan' }).click();
    await page.getByRole('radio', { name: /Knee — early strength/ }).check();
    await page.getByRole('button', { name: 'Create draft' }).click();

    await expect(page.getByRole('heading', { name: 'New plan (draft)' })).toBeVisible();
    await expect(page.getByLabel('Plan title')).toHaveValue('Knee — early strength');
    await page.getByLabel('Plan title').fill('Knee basics for Noa');
    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) await page.getByRole('checkbox', { name: day }).check({ force: true });
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-plan-editor.png`, fullPage: true });

    await page.getByRole('button', { name: 'Preview as patient' }).click();
    await expect(page.getByText('Patient view (preview)')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Patient view' }).getByText('Quad sets')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-plan-preview.png`, fullPage: true });

    // Not visible to the patient yet.
    const patientPage = await page.context().browser()!.newPage();
    await signIn(patientPage, 'noa@rehabquest.example');
    await expect(patientPage.getByRole('heading', { name: 'No plan yet' })).toBeVisible();

    await page.getByRole('button', { name: 'Publish to Noa Friedman' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText(/Published\. Noa Friedman will see it/)).toBeVisible();

    await patientPage.reload();
    await expect(patientPage.getByRole('heading', { name: /session is ready/i })).toBeVisible();
    await patientPage.close();
  });

  test('a stale draft editor gets a recoverable conflict', async ({ page, context }) => {
    await signIn(page, 'therapist@rehabquest.example');
    await page.getByRole('link', { name: /Yossi Mizrahi/ }).click();
    await page.getByRole('tab', { name: 'Plan' }).click();
    await page.getByRole('button', { name: 'Revise plan' }).click();
    await expect(page.getByRole('heading', { name: 'Revise plan (draft)' })).toBeVisible();
    const url = page.url();

    const other = await context.newPage();
    await other.goto(url);
    await other.getByLabel('Plan title').fill('Saved in the other tab');
    await other.getByRole('button', { name: 'Save draft' }).click();
    await expect(other.getByText('Draft saved')).toBeVisible();

    await page.getByLabel('Plan title').fill('My stale edit');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Someone else saved this draft after you opened it')).toBeVisible();
    await expect(page.getByLabel('Plan title')).toHaveValue('My stale edit'); // nothing lost
    await page.getByRole('button', { name: 'Load the latest version (discard my changes)' }).click();
    await expect(page.getByLabel('Plan title')).toHaveValue('Saved in the other tab');

    await page.getByRole('button', { name: 'Discard draft' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByText('Draft discarded')).toBeVisible();
    await other.close();
  });

  test('therapist sees the stopped exercise, drafts a summary and marks the report reviewed', async ({ page }) => {
    await signIn(page, 'therapist@rehabquest.example');
    await page.getByRole('link', { name: /Maya Levi/ }).click();
    await page.getByRole('tab', { name: 'Records' }).click();
    await expect(page.getByRole('cell', { name: 'Knee felt unstable on the last set.' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Not reported' }).first()).toBeVisible(); // the skipped exercise
    await page.getByRole('tab', { name: 'Summary draft' }).click();
    await page.getByRole('button', { name: 'Draft summary' }).click();
    await expect(page.getByText('Rule-based summary — no AI model was used')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-therapist-patient.png`, fullPage: true });

    await page.getByRole('link', { name: 'Reviews' }).click();
    const item = page.getByRole('article').filter({ hasText: 'Maya Levi' }).filter({ hasText: 'Stopped because of discomfort' }).first();
    await expect(item.getByText('Why this appears')).toBeVisible();
    await item.getByRole('button', { name: 'Mark as seen' }).click();
    await expect(page.getByText('Marked as seen')).toBeVisible();
    await item.getByRole('button', { name: 'Resolve' }).click();
    await page.getByRole('dialog').getByLabel('Resolution note (optional, visible to you)').fill('Called Maya; lowered the step height.');
    await page.getByRole('dialog').getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Resolved' }).click();
    await expect(page.getByText(/Called Maya; lowered the step height./)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Resolved' }).click();
    await expect(page.getByText(/Called Maya; lowered the step height./)).toBeVisible();
  });
});

test.describe('authentication and access', () => {
  test('wrong password, role redirects, and an expired session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('maya@rehabquest.example');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect email or password')).toBeVisible();

    await signIn(page, 'maya@rehabquest.example');
    await expect(page).toHaveURL(/\/patient$/);
    await page.goto('/therapist');
    await expect(page).toHaveURL(/\/patient$/);

    await page.evaluate(() => localStorage.setItem('rehabquest.token', 'expired.token.value'));
    await page.goto('/patient/progress');
    await expect(page).toHaveURL(/\/login\?.*reason=expired/);
    await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
  });

  test('registration creates a patient account only', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/Therapist accounts are set up by your clinic/)).toBeVisible();
    await page.getByLabel('Your name').fill('Test Person');
    await page.getByLabel('Email').fill(`person-${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();
    await page.getByLabel('Password').fill('long-enough-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/patient$/);
    await expect(page.getByRole('heading', { name: 'No plan yet' })).toBeVisible();
    await page.getByRole('link', { name: 'Show my care code' }).click();
    await expect(page.locator('code')).toHaveText(/^[0-9A-F]{8}$/);
  });

  test('keyboard: skip link and visible focus', async ({ page }) => {
    await signIn(page, 'yossi@rehabquest.example');
    await expect(page).toHaveURL(/\/patient$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: /session|rest|paused/i }).first()).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    expect(await skip.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  });
});

test.describe('mobile layout @mobile', () => {
  test('patient and therapist screens fit a phone screen @mobile', async ({ page }) => {
    await signIn(page, 'yossi@rehabquest.example');
    await expect(page).toHaveURL(/\/patient$/);
    await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/mobile-patient-home.png` });

    await page.getByRole('link', { name: 'Progress' }).last().click();
    await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible();
    await noHorizontalOverflow(page);

    await page.goto('/patient/session');
    if (await page.getByRole('button', { name: 'Start session' }).count()) {
      await page.screenshot({ path: `${SHOTS}/mobile-session-overview.png` });
      await page.getByRole('button', { name: 'Start session' }).click();
      await expect(page.getByRole('button', { name: 'I’m done with this exercise' })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/mobile-session.png` });
      await noHorizontalOverflow(page);
      await page.getByRole('button', { name: 'I’m done with this exercise' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'How did it feel?' })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/mobile-feedback.png`, fullPage: true });
      await noHorizontalOverflow(page);
    }

    await page.goto('/patient/profile');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'therapist@rehabquest.example');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/mobile-therapist-home.png`, fullPage: true });
  });
});
