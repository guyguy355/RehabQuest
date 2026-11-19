import { type BrowserContext, expect, type Page, test } from '@playwright/test';

// The animated 3D exercise demonstration on the patient's exercise screen (docs/EXERCISE_DEMOS.md).
// These tests only open the session; they never save an outcome, so other specs see a fresh session.
// The e2e API runs in development mode, where unreviewed demonstrations are shown as a labelled preview.

const PASSWORD = 'Demo1234!';
const SHOTS = 'test-results/screens';

type OverviewBody = { todayTasks: { completion: unknown; exercise: { demo: Record<string, unknown> | null } }[] };

/**
 * Signs in as the demo patient and opens the first exercise of today's session (Heel slides).
 * The overview is shown as if nothing was saved yet today (in the browser only), so these tests
 * do not depend on whether another spec already completed the session.
 */
async function openExercise(page: Page, mutate?: (exercise: OverviewBody['todayTasks'][number]['exercise']) => void) {
  await page.route('**/patient/overview', async (route) => {
    const response = await route.fetch().catch(() => null); // the page may close while a refresh is in flight
    if (!response) return;
    const body = (await response.json()) as OverviewBody;
    for (const task of body.todayTasks) {
      task.completion = null;
      mutate?.(task.exercise);
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('maya@rehabquest.example');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/patient$/);
  await page.goto('/patient/session');
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByRole('heading', { name: 'Heel slides' })).toBeVisible();
}

const player = (page: Page) => page.getByTestId('exercise-demo');
const frame = (page: Page) => player(page).getByRole('img', { name: 'Animated 3D demonstration of Heel slides' });
const cycleTime = async (page: Page) => Number(await frame(page).getAttribute('data-demo-time'));
const waitForCycleTime = (page: Page, from: number, to: number) =>
  page.waitForFunction(([min, max]) => {
    const time = Number(document.querySelector('[data-demo-time]')?.getAttribute('data-demo-time'));
    return time >= min && time <= max;
  }, [from, to] as const);

/** Scrolls the player to the middle of the screen, clear of the sticky session bar. */
const centre = (page: Page) => player(page).evaluate((element) => element.scrollIntoView({ block: 'center' }));

async function setTabVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test.describe('exercise demonstration', () => {
  test('plays in a loop on the exercise screen; pause, speed, views and visibility work; leaving cleans up', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    await openExercise(page);
    await expect(player(page).locator('canvas')).toBeVisible();
    await expect(player(page).getByText('Preview · not yet reviewed by a physiotherapist')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);

    // Autoplay and looping: the position in the repetition rises, wraps around once, and rises again.
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'playing');
    await waitForCycleTime(page, 6, 9);
    await waitForCycleTime(page, 0, 2);
    await waitForCycleTime(page, 3.4, 4.6); // heel closest to the body

    // Pause freezes the figure; the camera can still be moved while paused.
    await page.getByRole('button', { name: 'Pause demonstration' }).click();
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'paused');
    const pausedAt = await cycleTime(page);
    await page.waitForTimeout(1200);
    expect(await cycleTime(page)).toBe(pausedAt);
    await centre(page);
    await page.screenshot({ path: `${SHOTS}/desktop-exercise-demo.png` });

    const sideView = await frame(page).screenshot();
    await page.getByRole('button', { name: 'Front' }).click();
    await expect(page.getByRole('button', { name: 'Front' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await frame(page).screenshot()).equals(sideView)).toBe(false);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/desktop-exercise-demo-front.png` });
    await page.getByRole('button', { name: 'Side' }).click();

    // Resume, then compare how far the repetition gets in two seconds at each speed.
    await page.getByRole('button', { name: 'Play demonstration' }).click();
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'playing');
    const progressIn2s = async () => {
      await waitForCycleTime(page, 0, 2.5);
      const start = await cycleTime(page);
      await page.waitForTimeout(2000);
      return (await cycleTime(page)) - start;
    };
    await page.getByRole('button', { name: '0.5×' }).click();
    const slow = await progressIn2s();
    await page.getByRole('button', { name: '1.5×' }).click();
    const fast = await progressIn2s();
    expect(slow).toBeGreaterThan(0.5);
    expect(slow).toBeLessThan(1.6);
    expect(fast).toBeGreaterThan(slow * 1.8);
    await page.getByRole('button', { name: '1×', exact: true }).click();

    // Off screen and hidden tab: paused; back: playing again. (A short window, so the player can leave the screen.)
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(frame(page)).not.toBeInViewport();
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'paused');
    const offScreenAt = await cycleTime(page);
    await page.waitForTimeout(800);
    expect(await cycleTime(page)).toBe(offScreenAt);
    await centre(page);
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'playing');
    await page.setViewportSize({ width: 1280, height: 860 });
    await setTabVisibility(page, 'hidden');
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'paused');
    await setTabVisibility(page, 'visible');
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'playing');

    // Watching several repetitions records nothing: no set is ticked, nothing is saved.
    await expect(page.getByRole('button', { name: 'Set done', exact: true })).toHaveCount(0);
    await expect(page.getByText('0/4')).toBeVisible();

    // Leaving the exercise removes the canvas.
    await page.getByRole('link', { name: /Leave session/ }).click();
    await expect(page).toHaveURL(/\/patient$/);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('exercises without their own animation keep the existing content; failures fall back to the text', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const open = async (mutate: Parameters<typeof openExercise>[1]) => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await openExercise(page, mutate);
      await expect(page.getByRole('heading', { name: 'How to do it' })).toBeVisible();
      return page;
    };

    // No demonstration for this exercise: no player, no canvas.
    let page = await open((exercise) => (exercise.demo = null));
    await expect(player(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);

    // A key this client has no animation for: nothing generic is shown instead.
    page = await open((exercise) => exercise.demo && (exercise.demo.key = 'some-other-exercise'));
    await expect(player(page)).toHaveCount(0);

    // Approved: same player, without the preview label.
    page = await open((exercise) => exercise.demo && (exercise.demo.reviewStatus = 'APPROVED'));
    await expect(player(page).locator('canvas')).toBeVisible();
    await expect(player(page).getByText(/not yet reviewed/)).toHaveCount(0);

    // A model that cannot be loaded: a short message, and the written steps stay usable.
    page = await open((exercise) => exercise.demo && Object.assign(exercise.demo, { type: 'GLB', modelUrl: '/models/missing.glb' }));
    await expect(player(page).getByText('The 3D demonstration can’t be shown on this device. Follow the written steps below.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark set done' }).first()).toBeEnabled();
    for (const context of contexts) await context.close();
  });

  test('reduced motion: the demonstration starts paused on a still frame and plays on request', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openExercise(page);
    await expect(player(page).locator('canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play demonstration' })).toBeVisible();
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'paused');
    await expect(frame(page)).toHaveAttribute('data-demo-time', /\d/);
    const still = await cycleTime(page);
    await page.waitForTimeout(1200);
    expect(await cycleTime(page)).toBe(still);

    await page.getByRole('button', { name: 'Play demonstration' }).click();
    await expect(frame(page)).toHaveAttribute('data-demo-state', 'playing');
    await expect.poll(() => cycleTime(page)).not.toBe(still);
    await context.close();
  });
});

test.describe('exercise demonstration on a phone @mobile', () => {
  test('the figure is easy to see and does not cover the instructions @mobile', async ({ page }) => {
    await openExercise(page);
    await expect(player(page).locator('canvas')).toBeVisible();
    await waitForCycleTime(page, 3.4, 4.6);
    await page.getByRole('button', { name: 'Pause demonstration' }).click();
    await centre(page);
    await page.screenshot({ path: `${SHOTS}/mobile-exercise-demo.png` });

    const box = (await frame(page).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.width).toBeGreaterThan(viewport.width * 0.8);
    expect(box.height).toBeGreaterThan(200);
    expect(box.height).toBeLessThan(viewport.height * 0.6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // The steps follow the player in the normal page flow (nothing floats over them).
    const steps = (await page.getByRole('heading', { name: 'How to do it' }).boundingBox())!;
    const card = (await player(page).boundingBox())!;
    expect(steps.y).toBeGreaterThanOrEqual(card.y + card.height);
    for (const name of ['Play demonstration', '0.5×', 'Front', 'Side']) await expect(page.getByRole('button', { name })).toBeVisible();
  });
});
