import { test, expect } from "@playwright/test";

test("buyer can filter, inspect, add to cart and create a simulated receipt", async ({ page }) => {
  const externalApiCalls: string[] = [];
  page.on("request", r => { if (r.url().includes("/v1/")) externalApiCalls.push(r.url()); });
  await page.goto("/en/products?category=textiles&max_price=2000");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("link", { name: "View Natural linen · fabric bundle" }).click();
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create simulated order" }).click();
  await expect(page.getByRole("heading", { name: "Demo order created" })).toBeVisible();
  expect(externalApiCalls).toEqual([]);
});

test("sourcing requires an eligible offer and clears approval when constraints change", async ({ page }) => {
  await page.goto("/en/demo");
  await expect(page.getByText("Best fit: Faisalabad Wholesale Co.")).toBeVisible();
  await page.getByRole("button", { name: "Select offer" }).first().click();
  await page.getByRole("button", { name: "Approve demo selection" }).click();
  await expect(page.getByText("Demo decision recorded for this session.", { exact: false })).toBeVisible();
  await page.getByLabel("Total budget (PKR)").fill("1");
  await expect(page.getByText("No offers meet your brief.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selection approved in simulation" })).toHaveCount(0);
});

test("seller simulation advances and resets without authentication", async ({ page }) => {
  await page.goto("/en/sellers/lahore-textile-studio");
  await expect(page).toHaveURL(/\/en\/sellers\/lahore-textile-studio$/);
  await expect(page.getByRole("heading", { name: "Lahore Textile Studio" })).toBeVisible();
  await page.goto("/ur/seller");
  await expect(page).toHaveURL(/\/ur\/demo\?view=seller/);
  await page.getByRole("button", { name: "Move to Packing" }).click();
  await expect(page.getByText("Current sample status: Packing")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Current sample status: Confirmed")).toBeVisible();
});

test("mobile home fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
