import { test, expect, type Page, type Request, type Response } from "@playwright/test";
import { login } from "./utils/auth";

const desktopRoutes = [
  "/",
  "/students",
  "/movements",
  "/activities",
  "/scheduled-activities",
  "/meeting-minutes",
  "/payment-notifications",
  "/reimbursements",
];

const mobileRoutes = [
  "/mobile",
  "/mobile/board",
  "/mobile/finances",
  "/mobile/agenda",
  "/mobile/actas",
  "/mobile/profile",
];

function attachRuntimeWatchers(page: Page) {
  const jsErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (err: Error) => {
    jsErrors.push(err.message);
  });

  page.on("requestfailed", (req: Request) => {
    const reason = req.failure()?.errorText || "unknown";
    // Ignore browser-aborted requests during route transitions in SPA navigation.
    if (reason.includes("ERR_ABORTED")) return;
    failedRequests.push(`${req.method()} ${req.url()} :: ${reason}`);
  });

  page.on("response", (res: Response) => {
    const status = res.status();
    if (status >= 500) {
      failedRequests.push(`${res.request().method()} ${res.url()} :: HTTP ${status}`);
    }
  });

  return { jsErrors, failedRequests };
}

async function closeWelcomeIfPresent(page: Page) {
  const modalTitle = page.getByText(/¡bienvenido a tu panel!/i);
  if (await modalTitle.isVisible().catch(() => false)) {
    const closeBtn = page.getByRole("button", { name: /close|cerrar/i });
    if (await closeBtn.first().isVisible().catch(() => false)) {
      await closeBtn.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
  }
}

test.describe("authenticated smoke", () => {
  test("desktop routes load without critical runtime failures", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop smoke only");
    const loggedIn = await login(page);
    test.skip(!loggedIn, "Could not log in with E2E user");
    const { jsErrors, failedRequests } = attachRuntimeWatchers(page);

    for (const route of desktopRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await closeWelcomeIfPresent(page);
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    }

    expect(jsErrors, `JS errors: ${jsErrors.join("\n")}`).toEqual([]);
    expect(failedRequests, `Network/server failures: ${failedRequests.join("\n")}`).toEqual([]);
  });

  test("mobile routes load without critical runtime failures", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Mobile smoke only");
    const loggedIn = await login(page);
    test.skip(!loggedIn, "Could not log in with E2E user");
    const { jsErrors, failedRequests } = attachRuntimeWatchers(page);

    for (const route of mobileRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await closeWelcomeIfPresent(page);
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    }

    expect(jsErrors, `JS errors: ${jsErrors.join("\n")}`).toEqual([]);
    expect(failedRequests, `Network/server failures: ${failedRequests.join("\n")}`).toEqual([]);
  });
});
