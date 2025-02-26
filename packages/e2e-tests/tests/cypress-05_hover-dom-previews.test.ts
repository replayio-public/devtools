import { openDevToolsTab, openViewerTab, startTest } from "../helpers";
import {
  getSelectedTestCase,
  getTestCaseSteps,
  getTestRows,
  getTestSuitePanel,
  openCypressTestPanel,
} from "../helpers/testsuites";
import { waitFor } from "../helpers/utils";
import test, { expect } from "../testFixtureCloneRecording";

test.use({ exampleKey: "cypress-realworld/bankaccounts.spec.js" });

test("cypress-05: Test DOM node preview on user action step hover", async ({
  pageWithMeta: { page, recordingId },
  exampleKey,
}) => {
  await startTest(page, recordingId);
  await openViewerTab(page);

  await openCypressTestPanel(page);

  await openDevToolsTab(page);

  const testPanel = getTestSuitePanel(page);

  const isVisible = await testPanel.isVisible();
  expect(isVisible).toBe(true);

  // has 4 tests
  const rows = getTestRows(page);
  await waitFor(async () => {
    await expect(rows).toHaveCount(4);
  });

  const addAccountTest = rows.filter({ hasText: "creates a new bank account" }).first();

  await addAccountTest.click();
  const selectedRow = getSelectedTestCase(page);
  await waitFor(async () => {
    expect(await selectedRow.isVisible()).toBe(true);
    expect(selectedRow).toHaveCount(1);
  });

  const steps = getTestCaseSteps(selectedRow);
  const firstStep = steps.first();

  // Others are probably actions too, but we know these are here
  const userActionSteps = steps.filter({
    hasText: /click|type/,
  });

  // Hovering over a user action step should show a preview of the DOM node
  const firstClickStep = userActionSteps.first();

  // Note that the ID is dynamically generated based on the piece of the box model shown
  const highlighter = page.locator("#box-model-content");

  await waitFor(
    async () => {
      // Repeatedly hover over the first step and then the click step, to force the
      // `onMouseEnter` handler to keep checking if we have a DOM node entry available.
      await firstStep.hover({ timeout: 1000 });
      await firstClickStep.hover({ timeout: 1000 });
      await highlighter.waitFor({ state: "visible", timeout: 1000 });
    },
    // Give the evaluation plenty of time to complete
    { timeout: 30000 }
  );

  const pathDefinition = await highlighter.getAttribute("d");
  // Should have a meaningful SVG path of some kind for the highlighter
  expect(pathDefinition).toBeTruthy();
});
