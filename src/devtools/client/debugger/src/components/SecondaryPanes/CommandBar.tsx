/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { Suspense, useContext, useEffect, useState } from "react";
import { useImperativeCacheValue } from "suspense";

import CommandBarButton from "devtools/client/debugger/src/components/shared/Button/CommandBarButton";
import {
  executeCommandOperation,
  getExecutionPoint,
  getSelectedFrameId,
  getThreadContext,
} from "devtools/client/debugger/src/reducers/pause";
import { formatKeyShortcut } from "devtools/client/debugger/src/utils/text";
import KeyShortcuts from "devtools/client/shared/key-shortcuts";
import { framesCache } from "replay-next/src/suspense/FrameCache";
import {
  FIND_STEP_TARGET_COMMANDS,
  FindTargetCommand,
  resumeTargetCache,
} from "replay-next/src/suspense/ResumeTargetCache";
import { ReplayClientContext } from "shared/client/ReplayClientContext";
import { getOS, isMacOS } from "shared/utils/os";
import { isPointInRegion } from "shared/utils/time";
import Loader from "ui/components/shared/Loader";
import { getSelectedSourceId } from "ui/reducers/sources";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { trackEvent } from "ui/utils/telemetry";

const isOSX = isMacOS();

const COMMANDS = ["findResumeTarget", ...FIND_STEP_TARGET_COMMANDS] as const;

const KEYS: Record<"WINNT" | "Darwin" | "Linux", Record<(typeof COMMANDS)[number], string>> = {
  WINNT: {
    findResumeTarget: "F8",
    findReverseStepOverTarget: "Shift+F10",
    findStepOverTarget: "F10",
    findStepInTarget: "F11",
    findStepOutTarget: "Shift+F11",
  },
  Darwin: {
    findResumeTarget: "Cmd+\\",
    findReverseStepOverTarget: "Cmd+Shift+'",
    findStepOverTarget: "Cmd+'",
    findStepInTarget: "Cmd+;",
    findStepOutTarget: "Cmd+Shift+;",
  },
  Linux: {
    findResumeTarget: "F8",
    findReverseStepOverTarget: "Shift+F10",
    findStepOverTarget: "F10",
    findStepInTarget: "F11",
    findStepOutTarget: "Shift+F11",
  },
};

function getKey(action: string) {
  // @ts-expect-error could be 'Unknown', whatever
  return getKeyForOS(getOS(), action);
}

function getKeyForOS(os: keyof typeof KEYS, action: string): string {
  const osActions = KEYS[os] || KEYS.Linux;
  // @ts-expect-error whatever
  return osActions[action];
}

function formatKey(action: string) {
  const key = getKey(`${action}Display`) || getKey(action);
  if (isOSX) {
    const winKey = getKeyForOS("WINNT", `${action}Display`) || getKeyForOS("WINNT", action);
    // display both Windows type and Mac specific keys
    return formatKeyShortcut([key, winKey].join(" "));
  }
  return formatKeyShortcut(key);
}

export default function CommandBar() {
  return (
    <Suspense fallback={<Loader />}>
      <CommandBarSuspends />
    </Suspense>
  );
}

function CommandBarSuspends() {
  const cx = useAppSelector(getThreadContext);

  const [disableRewindResume, setDisableRewindResume] = useState(false);

  const dispatch = useAppDispatch();

  useEffect(() => {
    const shortcuts = new KeyShortcuts({
      window,
      target: document.body,
    });

    function handleEvent(e: KeyboardEvent, command: FindTargetCommand) {
      e.preventDefault();
      e.stopPropagation();
      dispatch(executeCommandOperation({ cx, command }));
    }

    COMMANDS.forEach(command =>
      shortcuts.on(getKey(command), (e: KeyboardEvent) => handleEvent(e, command))
    );

    if (isOSX) {
      // The Mac supports both the Windows Function keys
      // as well as the Mac non-Function keys
      COMMANDS.forEach(command =>
        shortcuts.on(getKeyForOS("WINNT", command), (e: KeyboardEvent) => handleEvent(e, command))
      );
    }

    return () => {
      COMMANDS.forEach(command => shortcuts!.off(getKey(command)));
      if (isOSX) {
        COMMANDS.forEach(command => shortcuts!.off(getKeyForOS("WINNT", command)));
      }
    };
  }, [cx, dispatch]);

  async function onRewind() {
    trackEvent("debugger.rewind");
    setDisableRewindResume(true);
    await dispatch(executeCommandOperation({ cx, command: "findRewindTarget" }));
    setDisableRewindResume(false);
  }
  async function onResume() {
    trackEvent("debugger.resume");
    setDisableRewindResume(true);
    await dispatch(executeCommandOperation({ cx, command: "findResumeTarget" }));
    setDisableRewindResume(false);
  }

  return (
    <div className="command-bar">
      <CommandBarButton
        disabled={disableRewindResume}
        key="rewind"
        onClick={onRewind}
        tooltip="Rewind Execution"
        type="rewind"
      />
      <CommandBarButton
        disabled={disableRewindResume}
        key="resume"
        onClick={onResume}
        tooltip={`Resume ${formatKey("findResumeTarget")}`}
        type="resume"
      />
      <div key="divider-2" className="divider" />
      <StepButton
        key="reverseStepOver"
        command="findReverseStepOverTarget"
        mixpanelEvent="debugger.reverse_step_over"
        tooltip="Reverse Step Over"
        type="reverseStepOver"
      />
      <StepButton
        key="stepOver"
        command="findStepOverTarget"
        mixpanelEvent="debugger.step_over"
        tooltip="Step Over"
        type="stepOver"
      />
      <div key="divider-3" className="divider" />
      <StepButton
        key="stepIn"
        command="findStepInTarget"
        mixpanelEvent="debugger.step_in"
        tooltip="Step In"
        type="stepIn"
      />
      <StepButton
        key="stepOut"
        command="findStepOutTarget"
        mixpanelEvent="debugger.step_out"
        tooltip="Step Out"
        type="stepOut"
      />
    </div>
  );
}

function StepButton({
  command,
  tooltip,
  type,
  mixpanelEvent,
}: {
  command: FindTargetCommand;
  tooltip: string;
  type: string;
  mixpanelEvent: any;
}) {
  const dispatch = useAppDispatch();
  const replayClient = useContext(ReplayClientContext);
  const focusWindow = replayClient.getCurrentFocusWindow();
  const cx = useAppSelector(getThreadContext);
  const point = useAppSelector(getExecutionPoint);
  const pauseAndFrameId = useAppSelector(getSelectedFrameId);
  const sourceId = useAppSelector(getSelectedSourceId);

  const { status: framesStatus, value: frames } = useImperativeCacheValue(
    framesCache,
    replayClient,
    pauseAndFrameId?.pauseId
  );

  const { status: stepTargetStatus, value: stepTarget } = useImperativeCacheValue(
    resumeTargetCache,
    replayClient,
    command,
    point,
    pauseAndFrameId,
    sourceId
  );

  const isPaused = framesStatus === "resolved" && frames && frames.length > 0;
  let disabled = false;
  let disabledTooltip = "";
  if (!isPaused) {
    disabled = true;
    disabledTooltip = "Stepping is disabled until you're paused at a point";
  } else if (stepTargetStatus === "pending") {
    disabled = true;
    disabledTooltip = "Loading step target...";
  } else if (stepTargetStatus === "rejected" || !stepTarget) {
    disabled = true;
    disabledTooltip = "Failed to find step target";
  } else if (!focusWindow || !isPointInRegion(stepTarget.point, focusWindow)) {
    disabled = true;
    disabledTooltip = "Stepping is disabled because the target is outside the current focus window";
  }

  function onClick() {
    trackEvent(mixpanelEvent);
    dispatch(executeCommandOperation({ cx, command }));
  }

  return (
    <CommandBarButton
      disabled={disabled}
      onClick={onClick}
      tooltip={tooltip}
      disabledTooltip={disabledTooltip}
      type={type}
    />
  );
}
