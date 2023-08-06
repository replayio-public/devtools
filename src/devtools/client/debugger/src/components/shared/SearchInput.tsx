/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//


import classnames from "classnames";
import React, { useState, useRef, useEffect, useCallback } from "react";

import AccessibleImage from "./AccessibleImage";
import { CloseButton } from "./Button";

const arrowBtn = (
  onClick: ((e: any) => void) | undefined,
  type: string,
  className: string,
  tooltip: string
) => {
  const props = {
    className,
    key: type,
    onClick,
    title: tooltip,
  };

  return (
    <button {...props}>
      <AccessibleImage className={type} />
    </button>
  );
};

interface SearchInputProps {
  query: string;
  count: number;
  dataTestId?: string;
  placeholder?: string;
  summaryMsg?: string;
  isLoading?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showErrorEmoji?: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onHistoryScroll?: (query: string) => void;
  handleNext?: (e: React.KeyboardEvent) => void;
  handlePrev?: (e: React.KeyboardEvent) => void;
  shouldFocus?: boolean;
  showClose?: boolean;
  hasPrefix?: boolean;
  expanded?: boolean;
  className?: string;
  handleClose?: () => void;
  selectedItemId?: string;
  size: string;
}

const SearchInput = (inputProps: SearchInputProps) => {


    const [history, setHistory] = useState([] as string[]);

    const $input = useRef<HTMLInputElement | null>(null);
    const props = { 
    className: "",
    expanded: false,
    hasPrefix: false,
    selectedItemId: "",
    size: "",
    showClose: true,
    ...inputProps,
  };
    useEffect(() => {
    setFocusHandler();
  }, []);
    useEffect(() => {
    if (props.shouldFocus && !prevProps.shouldFocus) {
      setFocusHandler();
    }
  }, []);
    const setFocusHandler = useCallback(() => {
    if ($input.current) {
      const input = $input.current;
      input.focus();

      if (!input.value) {
        return;
      }

      // omit prefix @:# from being selected
      const selectStartPos = props.hasPrefix ? 1 : 0;
      input.setSelectionRange(selectStartPos, input.value.length + 1);
    }
  }, []);
    const renderSvgHandler = useCallback(() => {
    return <AccessibleImage className="search" />;
  }, []);
    const renderArrowButtonsHandler = useCallback(() => {
    const { handleNext, handlePrev } = props;

    return [
      arrowBtn(handlePrev, "arrow-up", classnames("nav-btn", "prev"), "Previous result"),
      arrowBtn(handleNext, "arrow-down", classnames("nav-btn", "next"), "Next result"),
    ];
  }, []);
    const onFocusHandler = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { onFocus } = props;

    if (onFocus) {
      onFocus(e as any);
    }
  }, []);
    const onBlurHandler = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { onBlur } = props;

    if (onBlur) {
      onBlur(e as any);
    }
  }, []);
    const onKeyDownHandler = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { onHistoryScroll, onKeyDown } = props;
    if (!onHistoryScroll) {
      return onKeyDown(e);
    }

    const inputValue = (e.target as HTMLInputElement).value;
    
    const currentHistoryIndex = history.indexOf(inputValue);

    if (e.key === "Enter") {
      saveEnteredTermHandler(inputValue);
      return onKeyDown(e);
    }

    if (e.key === "ArrowUp") {
      const previous = currentHistoryIndex > -1 ? currentHistoryIndex - 1 : history.length - 1;
      const previousInHistory = history[previous];
      if (previousInHistory) {
        e.preventDefault();
        onHistoryScroll(previousInHistory);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      const next = currentHistoryIndex + 1;
      const nextInHistory = history[next];
      if (nextInHistory) {
        onHistoryScroll(nextInHistory);
      }
    }
  }, [history]);
    const saveEnteredTermHandler = useCallback((query: string) => {
    
    let newHistory = history.slice();
    const previousIndex = newHistory.indexOf(query);
    if (previousIndex !== -1) {
      newHistory.splice(previousIndex, 1);
    }
    newHistory.push(query);
    setHistory(newHistory);
  }, [history]);
    const renderSummaryMsgHandler = useCallback(() => {
    const { summaryMsg } = props;

    if (!summaryMsg) {
      return null;
    }

    return <div className="search-field-summary">{summaryMsg}</div>;
  }, []);
    const renderSpinnerHandler = useCallback(() => {
    const { isLoading } = props;
    if (isLoading) {
      return <AccessibleImage className="loader spin" />;
    }
  }, []);
    const renderNavHandler = useCallback(() => {
    const { count, handleNext, handlePrev } = props;
    if ((!handleNext && !handlePrev) || !count || count == 1) {
      return;
    }

    return <div className="search-nav-buttons">{renderArrowButtonsHandler()}</div>;
  }, []);

    const {
      className,
      dataTestId,
      expanded,
      handleClose,
      onChange,
      onKeyUp,
      placeholder,
      query,
      selectedItemId,
      showErrorEmoji,
      size,
      showClose,
    } = props;

    const inputProps = {};

    return (
      <div className={`search-outline ${className || ""}`}>
        <div
          className={classnames("search-field rounded-lg", size)}
          role="combobox"
          aria-haspopup="listbox"
          aria-owns="result-list"
          aria-expanded={expanded}
        >
          {renderSvgHandler()}
          <input
            className={classnames({
              empty: showErrorEmoji,
            })}
            data-test-id={dataTestId}
            onChange={onChange}
            onKeyDown={onKeyDownHandler}
            onKeyUp={onKeyUp}
            onFocus={onFocusHandler}
            onBlur={onBlurHandler}
            aria-autocomplete={"list" as const}
            aria-controls={"result-list" as const}
            aria-activedescendant={expanded && selectedItemId ? `${selectedItemId}-title` : ""}
            placeholder={placeholder}
            value={query}
            spellCheck={false}
            ref={(c: HTMLInputElement | null) => ($input.current = c)}
          />
          {renderSpinnerHandler()}
          {renderSummaryMsgHandler()}
          {renderNavHandler()}
          {showClose && <CloseButton handleClick={handleClose} buttonClass={size} tooltip="" />}
        </div>
      </div>
    ); 
};




export default SearchInput;
