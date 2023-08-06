/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//


import { useCallback } from "react";

import { formatKeyShortcut } from "../utils/text";

export export const ShortcutsModal = (props) => {


    

    const renderPrettyCombosHandler = useCallback((combo) => {
    return combo
      .split(" ")
      .map(c => (
        <span key={c} className="keystroke">
          {c}
        </span>
      ))
      .reduce((prev, curr) => [prev, " + ", curr]);
  }, []);
    const renderShorcutItemHandler = useCallback((title, combo) => {
    return (
      <li>
        <span>{title}</span>
        <span>{renderPrettyCombosHandler(combo)}</span>
      </li>
    );
  }, []);
    const renderSteppingShortcutsHandler = useCallback(() => {
    return (
      <ul className="shortcuts-list">
        {renderShorcutItemHandler("Step Over", "F10")}
        {renderShorcutItemHandler("Step In", "F11")}
        {renderShorcutItemHandler("Step Out", formatKeyShortcut("Shift+F11"))}
      </ul>
    );
  }, []);
    const renderSearchShortcutsHandler = useCallback(() => {
    return (
      <ul className="shortcuts-list">
        {renderShorcutItemHandler("Go to file", formatKeyShortcut("CmdOrCtrl+P"))}
        {renderShorcutItemHandler("Find next", formatKeyShortcut("Cmd+G"))}
        {renderShorcutItemHandler("Find in files", formatKeyShortcut("CmdOrCtrl+Shift+F"))}
        {renderShorcutItemHandler("Find function", formatKeyShortcut("CmdOrCtrl+Shift+O"))}
        {renderShorcutItemHandler("Find all functions", formatKeyShortcut("CmdOrCtrl+O"))}
        {renderShorcutItemHandler("Go to line", formatKeyShortcut("Ctrl+G"))}
      </ul>
    );
  }, []);
    const renderShortcutsContentHandler = useCallback(() => {
    return (
      <div className={classnames("shortcuts-content", props.additionalClass)}>
        <div className="shortcuts-section">
          <h2>{"Stepping"}</h2>
          {renderSteppingShortcutsHandler()}
        </div>
        <div className="shortcuts-section">
          <h2>{"Search"}</h2>
          {renderSearchShortcutsHandler()}
        </div>
      </div>
    );
  }, []);

    const { enabled } = props;

    if (!enabled) {
      return null;
    }

    return (
      <Modal in={enabled} additionalClass="shortcuts-modal" handleClose={props.handleClose}>
        {renderShortcutsContentHandler()}
      </Modal>
    ); 
};



