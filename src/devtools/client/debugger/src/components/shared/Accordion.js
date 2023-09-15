/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import classNames from "classnames";
import findLastIndex from "lodash/findLastIndex";
import { useCallback, cloneElement } from "react";

import AccessibleImage from "./AccessibleImage";

const Accordion = (props) => {


    

    const handleHeaderClickHandler = useCallback((i) => {
    const item = props.items[i];
    const opened = !item.opened;
    item.opened = opened;

    if (item.onToggle) {
      item.onToggle(opened);
    }

    // We force an update because otherwise the accordion
    // would not re-render
    forceUpdateHandler();
  }, []);
    const onHandleHeaderKeyDownHandler = useCallback((e, i) => {
    if (e && (e.key === " " || e.key === "Enter")) {
      handleHeaderClickHandler(i);
    }
  }, []);
    const renderContainerHandler = useCallback((item, i) => {
    const { opened } = item;
    const lastOpenedIndex = i === findLastIndex(props.items, item => item.opened);

    return (
      <li
        className={classNames(item.className, item.opened ? "expanded" : "collapsed", {
          lastOpen: lastOpenedIndex,
        })}
        key={i}
      >
        <h2
          className="_header bg-tabBgcolorAltSubtle"
          tabIndex="0"
          onKeyDown={e => onHandleHeaderKeyDownHandler(e, i)}
          onClick={() => handleHeaderClickHandler(i)}
        >
          <AccessibleImage className={`arrow ${opened ? "expanded" : ""}`} />
          <span className="header-label">{item.header}</span>
          {item.buttons ? (
            <div className="header-buttons" tabIndex="-1">
              {item.buttons}
            </div>
          ) : null}
        </h2>
        {opened && (
          <div className="_content">{cloneElement(item.component, item.componentProps || {})}</div>
        )}
      </li>
    );
  }, []);

    return <ul className="accordion">{props.items.map(renderContainerHandler)}</ul>; 
};




export default Accordion;
