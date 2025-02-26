import React, { MouseEvent, RefObject, UIEvent, useContext, useEffect, useRef } from "react";
import { ContextMenuItem, assertMouseEvent, useContextMenu } from "use-context-menu";

import {
  highlightNode,
  selectNode,
  unhighlightNode,
} from "devtools/client/inspector/markup/actions/markup";
import { assert } from "protocol/utils";
import Icon from "replay-next/components/Icon";
import { createTypeDataForVisualComment } from "replay-next/components/sources/utils/comments";
import { InspectorContext } from "replay-next/src/contexts/InspectorContext";
import { SessionContext } from "replay-next/src/contexts/SessionContext";
import { useNag } from "replay-next/src/hooks/useNag";
import { Nag } from "shared/graphql/types";
import { fetchMouseTargetsForPause } from "ui/actions/app";
import { createFrameComment } from "ui/actions/comments";
import { setSelectedPanel, setViewMode } from "ui/actions/layout";
import { stopPlayback } from "ui/actions/timeline";
import { isPlaying as isPlayingSelector } from "ui/reducers/timeline";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { getMouseTarget } from "ui/suspense/nodeCaches";
import { mouseEventCanvasPosition as getPositionForInspectingElement } from "ui/utils/nodePicker";

import styles from "./VideoContextMenu.module.css";

export default function useVideoContextMenu({
  canvasRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
}) {
  const { showCommentsPanel } = useContext(InspectorContext);
  const { accessToken, recordingId } = useContext(SessionContext);

  const dispatch = useAppDispatch();
  const isPlaying = useAppSelector(isPlayingSelector);

  const mouseEventDataRef = useRef<{
    pageX: number | null;
    pageY: number | null;
    position: { x: number; y: number } | null;
    targetNodeId: string | null;
  }>({
    pageX: null,
    pageY: null,
    position: null,
    targetNodeId: null,
  });

  const addComment = async ({
    pageX,
    pageY,
    position,
  }: {
    pageX: number | null;
    pageY: number | null;
    position: { x: number; y: number } | null;
  }) => {
    if (accessToken === null) {
      return;
    }

    const canvas = document.querySelector("canvas#graphics");

    const typeData = await createTypeDataForVisualComment(
      canvas as HTMLCanvasElement,
      pageX,
      pageY
    );

    dispatch(createFrameComment(position, recordingId, typeData));

    if (showCommentsPanel) {
      showCommentsPanel();
    }
  };

  const [, dismissInspectElementNag] = useNag(Nag.INSPECT_ELEMENT); // Replay Passport
  const inspectElement = () => {
    dismissInspectElementNag();
    const nodeId = mouseEventDataRef.current.targetNodeId;
    if (nodeId !== null) {
      dispatch(setViewMode("dev"));
      dispatch(setSelectedPanel("inspector"));
      dispatch(selectNode(nodeId));
    }
  };

  const onHide = () => {
    mouseEventDataRef.current.pageX = null;
    mouseEventDataRef.current.pageY = null;
    mouseEventDataRef.current.position = null;
    mouseEventDataRef.current.targetNodeId = null;

    dispatch(unhighlightNode());
  };

  const onShow = async (event: UIEvent) => {
    if (isPlaying) {
      dispatch(stopPlayback());
    }

    if (assertMouseEvent(event)) {
      const canvas = canvasRef.current;
      assert(canvas !== null);

      // Data needed for adding a comment:
      mouseEventDataRef.current.pageX = event.pageX;
      mouseEventDataRef.current.pageY = event.pageY;
      mouseEventDataRef.current.position = getPositionForAddingComment(event);

      // Data needed for inspecting an element:

      const position = getPositionForInspectingElement(event.nativeEvent, canvas);
      if (position != null) {
        const { x, y } = position;

        const boundingRects = await dispatch(fetchMouseTargetsForPause());
        const target = getMouseTarget(boundingRects ?? [], x, y);
        const targetNodeId = target?.node ?? null;
        mouseEventDataRef.current.targetNodeId = targetNodeId;
        if (targetNodeId !== null) {
          dispatch(highlightNode(targetNodeId));
        }
      }
    }
  };

  const { contextMenu, hideMenu, onContextMenu } = useContextMenu(
    <>
      {accessToken !== null && (
        <ContextMenuItem
          dataTestName="ContextMenuItem-AddComment"
          onSelect={() => addComment(mouseEventDataRef.current)}
        >
          <>
            <Icon className={styles.Icon} type="comment" />
            Add comment
          </>
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={inspectElement}>
        <>
          <Icon className={styles.Icon} type="inspect" />
          Inspect element
        </>
      </ContextMenuItem>
    </>,
    {
      dataTestName: "ContextMenu-Video",
      dataTestId: "ContextMenu-Video",
      onHide,
      onShow,
      requireClickToShow: true,
    }
  );

  useEffect(() => {
    if (contextMenu && isPlaying) {
      hideMenu();
    }
  }, [contextMenu, hideMenu, isPlaying]);

  return {
    addComment: (e: React.MouseEvent) =>
      addComment({
        pageX: e.pageX,
        pageY: e.pageY,
        position: getPositionForAddingComment(e),
      }),
    contextMenu,
    onContextMenu,
  };
}

function getPositionForAddingComment(event: MouseEvent): { x: number; y: number } {
  const canvas = document.getElementById("graphics");
  const bounds = canvas!.getBoundingClientRect();

  const scale = bounds.width / canvas!.offsetWidth;

  return {
    x: (event.clientX - bounds.left) / scale,
    y: (event.clientY - bounds.top) / scale,
  };
}
