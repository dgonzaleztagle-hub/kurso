import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";

function computeRutDv(num: number): string {
  let sum = 0;
  let multiplier = 2;
  const digits = String(num).split("").reverse();

  for (const d of digits) {
    sum += Number(d) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

function formatRut(num: number): string {
  const dv = computeRutDv(num);
  return `${num}-${dv}`;
}

async function dismissWelcomeModal(page: any) {
  const modalTitle = page.getByText(/¡bienvenido a tu panel!/i);
  if (await modalTitle.isVisible().catch(() => false)) {
    const closeByText = page.getByRole("button", { name: /×|cerrar|close/i });
    if (await closeByText.first().isVisible().catch(() => false)) {
      await closeByText.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(modalTitle).toHaveCount(0);
  }
}

test.describe("deep functional flows", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop deep flow only");
    const ok = await login(page);
    test.skip(!ok, "Owner login not available");
  });

test("desktop CRUD-critical flow works end-to-end", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop deep flow only");
    test.setTimeout(180_000);
    const stamp = Date.now();
    const studentName = `E2E Alumno ${stamp}`;
    const [firstName, ...lastParts] = studentName.split(" ");
    const lastName = lastParts.join(" ");
    const rut = formatRut(20_000_000 + Number(String(stamp).slice(-5)));
    const minuteText = `Acta E2E ${stamp}`;
    const supplier = `Proveedor E2E ${stamp}`;
    const expenseConcept = `Concepto E2E ${stamp}`;
    const postTitle = `Anuncio E2E ${stamp}`;
    const postContent = `Contenido E2E ${stamp}`;

    // 1) Students: create
    await page.goto("/students");
    await dismissWelcomeModal(page);
    await page.getByRole("button", { name: /nuevo alumno/i }).click();
    await page.getByLabel("Nombres").fill(firstName);
    await page.getByLabel("Apellidos").fill(lastName);
    await page.getByLabel(/RUT/i).fill(rut);
    await page.getByRole("button", { name: /registrar alumno/i }).click();
    await expect(page.getByText(new RegExp(firstName, "i")).first()).toBeVisible();

    // 2) Meeting minutes: create
    await page.goto("/meeting-minutes");
    await page.getByRole("button", { name: /nueva acta/i }).click();
    await page.getByPlaceholder(/puntos tratados en la reunión/i).fill(minuteText);
    await page.getByRole("button", { name: /guardar acta/i }).click();
    await expect(page.getByText(minuteText)).toBeVisible();

    // 3) Movements: expense register
    await page.goto("/movements");
    await page.getByRole("button", { name: /^egreso$/i }).click();
    await page.getByLabel("Monto").fill("3500");
    const recipientCombo = page.getByRole("combobox").first();
    await recipientCombo.click();
    const newRecipientOption = page.getByRole("option", { name: /escribir nuevo destinatario/i });
    if (await newRecipientOption.count()) {
      await newRecipientOption.first().click();
      await page.getByLabel(/nuevo destinatario/i).fill(supplier);
    } else {
      const recipientInput = page.getByRole("combobox").nth(1);
      await recipientInput.fill(supplier);
      await recipientInput.press("Enter");
    }
    await page.getByLabel(/concepto \(glosa\)/i).fill(expenseConcept);
    await page.getByRole("button", { name: /registrar egreso/i }).click();
    await expect(page.getByText(/egreso registrado|movimiento registrado|folio/i)).toBeVisible();

    // 4) Posts: create and validate appears in mobile board route
    await page.goto("/posts");
    await page.getByRole("button", { name: /nuevo anuncio/i }).click();
    await page.getByLabel("Título").fill(postTitle);
    await page.getByLabel("Contenido").fill(postContent);
    await page.getByRole("button", { name: /^publicar$/i }).click();
    await expect(page.getByText(postTitle)).toBeVisible();

    await page.goto("/mobile/board");
    await expect(page.getByText(postTitle)).toBeVisible();
  });
});
