import { test, expect } from "@playwright/test";
import { getE2ECreds, login } from "./utils/auth";

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

function attachRuntimeWatchers(page: any) {
  const jsErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (err: Error) => {
    jsErrors.push(err.message);
  });

  page.on("requestfailed", (req: any) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
  });

  page.on("response", (res: any) => {
    const status = res.status();
    if (status >= 500) {
      failedRequests.push(`${res.request().method()} ${res.url()} :: HTTP ${status}`);
    }
  });

  return { jsErrors, failedRequests };
}

test.describe("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!getE2ECreds().enabled, "E2E creds missing: set E2E_EMAIL and E2E_PASSWORD");
    const loggedIn = await login(page);
    test.skip(!loggedIn, "Could not log in with provided E2E credentials");
  });

  test("desktop routes load without critical runtime failures", async ({ page }) => {
    const { jsErrors, failedRequests } = attachRuntimeWatchers(page);

    for (const route of desktopRoutes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    }

    expect(jsErrors, `JS errors: ${jsErrors.join("\n")}`).toEqual([]);
    expect(failedRequests, `Network/server failures: ${failedRequests.join("\n")}`).toEqual([]);
  });

  test("mobile routes load without critical runtime failures", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile project runs on chromium only");
    const { jsErrors, failedRequests } = attachRuntimeWatchers(page);

    for (const route of mobileRoutes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
    }

    expect(jsErrors, `JS errors: ${jsErrors.join("\n")}`).toEqual([]);
    expect(failedRequests, `Network/server failures: ${failedRequests.join("\n")}`).toEqual([]);
  });
});

