/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */


import React, { useRef, useCallback } from 'react';

interface DraggableProps {
  onMove: (x: number, y: number) => void;
  onStart: () => void;
  onStop: () => void;
  style: React.CSSProperties;
  className: string;
}

const Draggable = (props: DraggableProps) => {


    

    const isDragging = useRef(false);
    const draggableEl = useRef<HTMLDivElement>();
    const startDraggingHandler = useCallback((ev: React.MouseEvent) => {
    if (isDragging.current) {
      return;
    }
    isDragging.current = true;

    ev.preventDefault();
    const doc = draggableEl.current!.ownerDocument;
    doc.addEventListener("mousemove", onMoveHandler);
    doc.addEventListener("mouseup", onUpHandler);
    props.onStart && props.onStart();
  }, []);
    const onMoveHandler = useCallback((ev: MouseEvent) => {
    if (!isDragging.current) {
      return;
    }

    ev.preventDefault();
    // Use viewport coordinates so, moving mouse over iframes
    // doesn't mangle (relative) coordinates.
    props.onMove(ev.clientX, ev.clientY);
  }, []);
    const onUpHandler = useCallback((ev: MouseEvent) => {
    if (!isDragging.current) {
      return;
    }
    isDragging.current = false;

    ev.preventDefault();
    const doc = draggableEl.current!.ownerDocument;
    doc.removeEventListener("mousemove", onMoveHandler);
    doc.removeEventListener("mouseup", onUpHandler);
    props.onStop && props.onStop();
  }, []);

    return (
      <div
        ref={draggableEl.current}
        role="presentation"
        style={props.style}
        className={props.className}
        onMouseDown={startDraggingHandler}
      />
    ); 
};




export default Draggable;
