import { openDevToolsTab, startTest } from "../helpers";
import { executeAndVerifyTerminalExpression } from "../helpers/console-panel";
import { rewindToLine } from "../helpers/pause-information-panel";
import { addBreakpoint } from "../helpers/source-panel";
import test from "../testFixtureCloneRecording";

test.use({ exampleKey: "doc_rr_basic.html" });

test(`breakpoints-02: Test unhandled divergence while evaluating at a breakpoint`, async ({
  pageWithMeta: { page, recordingId },
  exampleKey,
}) => {
  await startTest(page, recordingId);
  await openDevToolsTab(page);

  await addBreakpoint(page, { lineNumber: 21, url: exampleKey });

  await rewindToLine(page, 21);

  await executeAndVerifyTerminalExpression(page, "number", "10");
  await executeAndVerifyTerminalExpression(page, "dump(3)", `undefined`);
  await executeAndVerifyTerminalExpression(page, "number", "10");
  await executeAndVerifyTerminalExpression(page, "dump(3)", `undefined`);
  await executeAndVerifyTerminalExpression(page, "number", "10");
  await executeAndVerifyTerminalExpression(page, "testStepping2()", "undefined");
});
