/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */


//
import { useState, useRef, useCallback } from "react";

export export const Dropdown = (inputProps) => {


    const [dropdownShown, setDropdownShown] = useState(false);

    const toggleDropdown = useRef();
    const props = { 
    panelStyles: {},
    ...inputProps,
  };
    const toggleDropdownHandler = useCallback(e => {
    setDropdownShown(!prevState.dropdownShown);
  }, []);
    const renderPanelHandler = useCallback(() => {
    const { panelStyles } = props;
    return (
      <div
        className="dropdown"
        onClick={toggleDropdown.current}
        style={{ display: dropdownShown ? "block" : "none", ...panelStyles }}
      >
        {props.panel}
      </div>
    );
  }, [dropdownShown]);
    const renderButtonHandler = useCallback(() => {
    return (
      // eslint-disable-next-line prettier/prettier
      <button className="dropdown-button" onClick={toggleDropdown.current}>
        {props.icon}
      </button>
    );
  }, []);
    const renderMaskHandler = useCallback(() => {
    return (
      <div
        className="dropdown-mask"
        onClick={toggleDropdown.current}
        style={{ display: dropdownShown ? "block" : "none" }}
      />
    );
  }, [dropdownShown]);

    return (
      <div className={classnames("dropdown-block", { open: dropdownShown })}>
        {renderPanelHandler()}
        {renderButtonHandler()}
        {renderMaskHandler()}
      </div>
    ); 
};




export default Dropdown;
