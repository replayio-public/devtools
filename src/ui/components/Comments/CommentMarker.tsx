
import React, { useCallback } from 'react';
import { ConnectedProps, connect } from "react-redux";

import { actions } from "ui/actions";
import { selectors } from "ui/reducers";
import { UIState } from "ui/state";
import { Comment } from "ui/state/comments";
import { trackEvent } from "ui/utils/telemetry";
import { getMarkerLeftOffset } from "ui/utils/timeline";

const markerWidth = 19;

interface CommentMarkerProps extends PropsFromRedux {
  comment: Comment;
  comments: Comment[];
  isPrimaryHighlighted: boolean;
}

const CommentMarker = (props: CommentMarkerProps) => {


    

    const calculateLeftOffsetHandler = useCallback((time: number) => {
    const { timelineDimensions, zoomRegion } = props;

    return getMarkerLeftOffset({
      time: time,
      overlayWidth: timelineDimensions.width,
      zoom: zoomRegion,
      markerWidth: markerWidth,
    });
  }, []);
    const getCommentAtTimeHandler = useCallback(() => {
    const { comments, currentTime } = props;
    const index = comments.findIndex(comment => comment.time === currentTime);

    return comments[index];
  }, []);
    const onClickHandler = useCallback((e: React.MouseEvent) => {
    // This should not count as a click on the timeline, which would seek to a particular time.
    e.stopPropagation();
    const { comment, seekToComment } = props;
    trackEvent("timeline.comment_select");
    seekToComment(comment, comment.sourceLocation, false);
  }, []);

    const { comment, currentTime, zoomRegion, isPrimaryHighlighted } = props;

    const { time } = comment;

    if (!time || time > zoomRegion.endTime) {
      return null;
    }

    const pausedAtComment = currentTime == time;

    return (
      <div
        className={classnames("img comment-marker", {
          paused: pausedAtComment,
          "primary-highlight": isPrimaryHighlighted,
        })}
        style={{
          left: `${calculateLeftOffsetHandler(time)}%`,
        }}
        onClick={onClickHandler}
      />
    ); 
};




const connector = connect(
  (state: UIState) => ({
    timelineDimensions: selectors.getTimelineDimensions(state),
    zoomRegion: selectors.getZoomRegion(state),
    currentTime: selectors.getCurrentTime(state),
  }),
  {
    seekToComment: actions.seekToComment,
  }
);
type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(CommentMarker);
