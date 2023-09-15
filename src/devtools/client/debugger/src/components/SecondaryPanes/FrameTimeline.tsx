/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//


import {
    Location,
    PointDescription,
    SourceLocation,
    getSourceOutlineResult,
} from "@replayio/protocol";
import classnames from "classnames";
import React, { useState, useRef, useEffect, useCallback, Suspense, useContext } from "react";
import ReactTooltip from "react-tooltip";

import { locationsInclude } from "protocol/utils";
import { frameStepsCache } from "replay-next/src/suspense/FrameStepsCache";
import { sourceOutlineCache } from "replay-next/src/suspense/SourceOutlineCache";
import { ReplayClientContext } from "shared/client/ReplayClientContext";
import { userData } from "shared/user-data/GraphQL/UserData";
import { actions } from "ui/actions";
import {
    SourcesState,
    getPreferredLocation,
    getSelectedLocation,
    getSelectedSource,
} from "ui/reducers/sources";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { trackEvent } from "ui/utils/telemetry";

import { PartialLocation } from "../../actions/sources/select";
import { PauseFrame, getExecutionPoint } from "../../reducers/pause";
import { getSelectedFrameSuspense } from "../../selectors/pause";

function getBoundingClientRect(element?: HTMLElement) {
  if (!element) {
    return;
  }
  return element.getBoundingClientRect();
}

interface FrameTimelineState {
  scrubbing: boolean;
  scrubbingProgress: number;
  lastDisplayIndex: number;
}

interface FrameTimelineProps {
  executionPoint: string | null;
  selectedLocation: PartialLocation | null;
  selectedFrame: PauseFrame | null;
  frameSteps: PointDescription[] | undefined;
  symbols: getSourceOutlineResult | null;
  seek: (point: string, time: number, hasFrames: boolean) => void;
  setPreviewPausedLocation: (location: Location) => void;
  sourcesState: SourcesState;
}

const FrameTimelineRenderer = (props: FrameTimelineProps) => {


    const [scrubbing, setScrubbing] = useState(false);
    const [scrubbingProgress, setScrubbingProgress] = useState(0);
    const [lastDisplayIndex, setLastDisplayIndex] = useState(0);

    const _timeline = useRef<HTMLDivElement>();
    useEffect(() => {
    if (!document.body) {
      return;
    }

    const bodyClassList = document.body.classList;

    if (scrubbing && !prevState.scrubbing) {
      document.addEventListener("mousemove", onMouseMoveHandler);
      document.addEventListener("mouseup", onMouseUpHandler);
      bodyClassList.add("scrubbing");
    }
    if (!scrubbing && prevState.scrubbing) {
      document.removeEventListener("mousemove", onMouseMoveHandler);
      document.removeEventListener("mouseup", onMouseUpHandler);
      bodyClassList.remove("scrubbing");
    }
  }, [scrubbing]);
    const getProgressHandler = useCallback((clientX: number) => {
    const rect = getBoundingClientRect(_timeline.current || undefined);
    if (!rect) {
      return 0;
    }
    const progress = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, []);
    const getPosition = useMemo(() => {
    const { frameSteps, symbols, selectedLocation } = props;
    if (!frameSteps) {
      return;
    }

    const numberOfPositions = frameSteps.length;
    const displayIndex = Math.floor((progress / 100) * numberOfPositions);

    // We cap the index to the actual existing indices in framePositions.
    // This way, we don't let the index reference an element that doesn't exist.
    // e.g. displayIndex = 3, framePositions.length = 3 => framePositions[3] is undefined
    let adjustedDisplayIndex = Math.min(displayIndex, numberOfPositions - 1);

    // skip over steps that are mapped to the beginning of a function body
    // see SCS-172
    const bodyLocations = symbols?.functions.map(f => f.body).filter(Boolean) as SourceLocation[];
    if (userData.get("feature_brokenSourcemapWorkaround") && bodyLocations) {
      while (adjustedDisplayIndex < numberOfPositions - 2) {
        const location = frameSteps[adjustedDisplayIndex].frame?.find(
          location => location.sourceId === selectedLocation?.sourceId
        );
        if (location && locationsInclude(bodyLocations, location)) {
          adjustedDisplayIndex++;
        } else {
          break;
        }
      }
    }

    setLastDisplayIndex(adjustedDisplayIndex);

    return frameSteps[adjustedDisplayIndex];
  }, []);
    const displayPreviewHandler = useCallback((progress: number) => {
    const { setPreviewPausedLocation, sourcesState } = props;

    const frameStep = getPosition(progress);

    if (frameStep?.frame) {
      setPreviewPausedLocation(getPreferredLocation(sourcesState, frameStep.frame));
    }
  }, []);
    const onMouseDownHandler = useCallback((event: React.MouseEvent) => {
    if (!props.frameSteps) {
      return null;
    }

    const progress = getProgressHandler(event.clientX);
    trackEvent("frame_timeline.start");
    setScrubbing(true);
    setScrubbingProgress(progress);
  }, []);
    const onMouseUpHandler = useCallback((event: MouseEvent) => {
    const { seek } = props;

    const progress = getProgressHandler(event.clientX);
    const position = getPosition(progress);
    setScrubbing(false);

    if (position) {
      seek(position.point, position.time, true);
    }
  }, []);
    const onMouseMoveHandler = useCallback((event: MouseEvent) => {
    const progress = getProgressHandler(event.clientX);

    displayPreviewHandler(progress);
    setScrubbingProgress(progress);
  }, []);
    const getVisibleProgressHandler = useCallback(() => {
    
    const { frameSteps, selectedLocation, executionPoint } = props;

    if (!frameSteps) {
      return 0;
    }

    if (scrubbing || !selectedLocation) {
      return scrubbingProgress;
    }

    // If we stepped using the debugger commands and the executionPoint is null
    // because it's being loaded, just show the last progress.
    if (!executionPoint) {
      return;
    }

    const filteredSteps = frameSteps.filter(
      position => BigInt(position.point) <= BigInt(executionPoint)
    );

    // Check if the current executionPoint's corresponding index is similar to the
    // last index that we stopped scrubbing on. If it is, just use the same progress
    // value that we had while scrubbing so instead of snapping to the executionPoint's
    // progress.
    if (lastDisplayIndex == filteredSteps.length - 1) {
      return scrubbingProgress;
    }

    return Math.floor((filteredSteps.length / frameSteps.length) * 100);
  }, [scrubbing, scrubbingProgress, lastDisplayIndex]);

    
    const { frameSteps } = props;
    const progress = getVisibleProgressHandler();

    return (
      <div
        data-tip="Frame Progress"
        data-for="frame-timeline-tooltip"
        className={classnames("frame-timeline-container", { scrubbing, paused: frameSteps })}
      >
        <div className="frame-timeline-bar" onMouseDown={onMouseDownHandler} ref={_timeline.current}>
          <div
            className="frame-timeline-progress"
            style={{ width: `${progress}%`, maxWidth: "calc(100% - 2px)" }}
          />
        </div>
        {frameSteps && (
          <ReactTooltip id="frame-timeline-tooltip" delayHide={200} delayShow={200} place={"top"} />
        )}
      </div>
    ); 
};




function FrameTimeline() {
  const replayClient = useContext(ReplayClientContext);
  const sourcesState = useAppSelector(state => state.sources);
  const executionPoint = useAppSelector(getExecutionPoint);
  const selectedLocation = useAppSelector(getSelectedLocation);
  const selectedFrame = useAppSelector(state => getSelectedFrameSuspense(replayClient, state));
  const source = useAppSelector(getSelectedSource);
  const symbols = source ? sourceOutlineCache.read(replayClient, source.id) : null;
  const frameSteps = selectedFrame
    ? frameStepsCache.read(replayClient, selectedFrame.pauseId, selectedFrame.protocolId)
    : undefined;
  const dispatch = useAppDispatch();

  const seek = (point: string, time: number, openSource: boolean) =>
    dispatch(actions.seek(point, time, openSource));
  const setPreviewPausedLocation = (location: Location) =>
    dispatch(actions.setPreviewPausedLocation(location));

  return (
    <FrameTimelineRenderer
      executionPoint={executionPoint}
      selectedLocation={selectedLocation}
      selectedFrame={selectedFrame}
      frameSteps={frameSteps}
      sourcesState={sourcesState}
      symbols={symbols}
      seek={seek}
      setPreviewPausedLocation={setPreviewPausedLocation}
    />
  );
}

export default function FrameTimelineSuspenseWrapper() {
  return (
    <Suspense
      fallback={
        <div
          data-tip="Frame Progress"
          data-for="frame-timeline-tooltip"
          className="frame-timeline-container"
        >
          <div className="frame-timeline-bar"></div>
        </div>
      }
    >
      <FrameTimeline />
    </Suspense>
  );
}
