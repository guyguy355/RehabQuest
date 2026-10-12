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

test.describe.serial('core workflow', () => {
  test('patient finishes today’s session; rewards and progress survive a reload', async ({ page }) => {
    await signIn(page, 'maya@rehabquest.example');
    await expect(page).toHaveURL(/\/patient$/);
    await expect(page.getByRole('heading', { name: /session is ready/i })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-patient-home.png`, fullPage: false });

    const xpBefore = Number(await page.getByTitle('XP earned for planned exercises').locator('.tabular').innerText());

    await page.getByRole('link', { name: 'Start session' }).click();
    await expect(page).toHaveURL(/\/patient\/session$/);
    const counter = await page.locator('span.tabular', { hasText: /^\d+\/\d+$/ }).first().innerText();
    const total = Number(counter.split('/')[1]);
    expect(total).toBeGreaterThan(1);
    await page.screenshot({ path: `${SHOTS}/desktop-session-exercise.png` });

    // Exercise 1: stop because of symptoms.
    await page.getByRole('button', { name: /Stop – I have pain or symptoms/ }).click();
    await expect(page.getByRole('heading', { name: 'Stopping was the right call' })).toBeVisible();
    // Validation: pain is required.
    await page.getByRole('button', { name: 'Save and tell my therapist' }).click();
    await expect(page.getByText('Choose a number from 0 to 10')).toBeVisible();
    await choosePain(page, 6);
    await page.getByLabel('What happened? (optional)').fill('Knee felt unstable on the last set.');
    await page.screenshot({ path: `${SHOTS}/desktop-session-stop.png` });
    await page.getByRole('button', { name: 'Save and tell my therapist' }).click();
    await expect(page.getByText(`1/${total}`)).toBeVisible();

    // Remaining exercises: completed. The second one is double-clicked on purpose.
    for (let index = 1; index < total; index += 1) {
      await page.getByRole('button', { name: 'I finished this exercise' }).click();
      await choosePain(page, 2);
      await page.getByRole('radio', { name: 'About right' }).check({ force: true });
      const save = page.getByRole('button', { name: 'Save and continue' });
      if (index === 1) await save.dblclick();
      else await save.click();
      if (index < total - 1) await expect(page.getByText(`${index + 1}/${total}`)).toBeVisible();
    }

    await expect(page).toHaveURL(/\/patient\/session\/complete$/);
    await expect(page.getByRole('heading', { name: 'Session complete!' })).toBeVisible();
    // (total - 1) completed exercises × 10 XP + 20 XP session bonus; the stopped one earns no task XP.
    const expectedXp = (total - 1) * 10 + 20;
    await expect(page.getByText('XP earned').locator('..')).toContainText(String(expectedXp));
    await page.screenshot({ path: `${SHOTS}/desktop-session-complete.png` });

    await page.getByRole('link', { name: 'Back to my path' }).click();
    await expect(page.getByRole('heading', { name: /session is done/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /session is done/i })).toBeVisible();
    const xpAfter = Number(await page.getByTitle('XP earned for planned exercises').locator('.tabular').innerText());
    expect(xpAfter - xpBefore).toBe(expectedXp);

    // Exactly one record per exercise today, despite the double click.
    await page.getByRole('link', { name: 'Progress' }).first().click();
    const todayCard = page.locator('section[aria-labelledby="history"] > ul > li').first();
    await expect(todayCard.locator('ul > li')).toHaveCount(total);
    await expect(todayCard).toContainText('Stopped safely');
    await page.screenshot({ path: `${SHOTS}/desktop-progress.png`, fullPage: true });
  });

  test('therapist sees the flagged report, drafts a summary and marks the report reviewed', async ({ page }) => {
    await signIn(page, 'therapist@rehabquest.example');
    await expect(page).toHaveURL(/\/therapist$/);
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-therapist-home.png` });

    await page.getByRole('link', { name: /Maya Levi/ }).click();
    await expect(page.getByRole('heading', { name: 'Maya Levi' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Knee felt unstable on the last set.' })).toBeVisible();

    await page.getByRole('button', { name: 'Draft summary' }).click();
    await expect(page.getByText('Rule-based summary — no AI model was used')).toBeVisible();
    await expect(page.getByText(/No AI provider is configured/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-therapist-patient.png`, fullPage: true });

    await page.getByLabel('Only open reports').check();
    const before = await page.getByRole('button', { name: 'Mark reviewed' }).count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Mark reviewed' }).first().click();
    await expect(page.getByText('Marked as reviewed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark reviewed' })).toHaveCount(before - 1);

    await page.reload();
    await page.getByLabel('Only open reports').check();
    await expect(page.getByRole('button', { name: 'Mark reviewed' })).toHaveCount(before - 1);
  });

  test('therapist links a patient with a care code and assigns a plan the patient can see', async ({ page }) => {
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
    await page.getByRole('link', { name: 'Create plan' }).click();
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByText('Title is required')).toBeVisible();

    await page.getByLabel('Plan title').fill('Ankle basics');
    await page.getByLabel('Focus area').fill('Ankle');
    for (const day of ['Sunday', 'Tuesday', 'Thursday', 'Saturday']) await page.getByRole('checkbox', { name: day }).check({ force: true });
    await page.getByLabel('Add from your library').selectOption({ label: 'Calf raises (Ankle)' });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Sets').fill('3');
    await page.screenshot({ path: `${SHOTS}/desktop-plan-editor.png`, fullPage: true });
    await page.getByRole('button', { name: 'Create plan' }).click();

    await expect(page.getByText('Plan created and shared with the patient')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ankle basics' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).last().click();
    await signIn(page, 'noa@rehabquest.example');
    await expect(page.getByRole('heading', { name: /session is ready/i })).toBeVisible();
    await page.getByRole('link', { name: 'Start session' }).click();
    await expect(page.getByRole('heading', { name: 'Calf raises' })).toBeVisible();
    await expect(page.getByText('3 × 12')).toBeVisible();
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

    // Simulate an expired/invalid token: the next API call returns 401.
    await page.evaluate(() => localStorage.setItem('rehabquest.token', 'expired.token.value'));
    await page.goto('/patient/progress');
    await expect(page).toHaveURL(/\/login\?.*reason=expired/);
    await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
  });

  test('registration creates a patient account only', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/Therapist accounts are set up by your clinic/)).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
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
    await page.reload(); // start keyboard navigation from the top of a fresh page
    await expect(page.getByRole('heading', { name: /session/i }).first()).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    const outline = await skip.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });
});

test.describe('mobile layout @mobile', () => {
  test('patient and therapist screens fit a phone screen @mobile', async ({ page }) => {
    await signIn(page, 'yossi@rehabquest.example');
    await expect(page).toHaveURL(/\/patient$/);
    await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/mobile-patient-home.png` });

    await page.getByRole('link', { name: 'Progress' }).last().click();
    await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/mobile-progress.png`, fullPage: true });

    await page.goto('/patient/session');
    await expect(page.getByRole('button', { name: 'I finished this exercise' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/mobile-session.png` });
    await page.getByRole('button', { name: 'I finished this exercise' }).click();
    await expect(page.getByRole('heading', { name: 'How did it feel?' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/mobile-feedback.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.goto('/patient/profile');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'therapist@rehabquest.example');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/mobile-therapist-home.png`, fullPage: true });
  });
});
