/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */


import React, { useState, useCallback } from 'react';

export interface AccordionItem {
  buttons?: React.ReactNode[];
  className?: string;
  component: React.ComponentType<any>;
  componentProps: Record<string, unknown>;
  contentClassName?: string;
  header: string;
  id: string;
  onToggle: (opened: boolean) => void;
  opened: boolean;
}

interface AccordionProps {
  style?: React.CSSProperties;
  items: AccordionItem[];
}

interface AccordionState {
  opened: Record<string, boolean>;
  everOpened: Record<string, boolean>;
}

const Accordion = (props: AccordionProps) => {


    const [opened, setOpened] = useState({});
    const [everOpened, setEverOpened] = useState({});

    const onHeaderClickHandler = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    // In the Browser Toolbox's Inspector/Layout view, handleHeaderClick is
    // called twice unless we call stopPropagation, making the accordion item
    // open-and-close or close-and-open
    event.stopPropagation();
    toggleItemHandler(event.currentTarget.parentElement!.id);
  }, []);
    const onHeaderKeyDownHandler = useCallback((event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggleItemHandler(event.currentTarget.parentElement!.id);
    }
  }, []);
    /**
   * Expand or collapse an accordion list item.
   * @param  {String} id Id of the item to be collapsed or expanded.
   */
    const toggleItemHandler = useCallback((id: string) => {
    const item = props.items.find((x: AccordionItem) => x.id === id);
    const opened = !opened[id];
    // We could have no item if props just changed
    if (!item) {
      return;
    }

    setEverOpened({
        ...everOpened,
        [id]: true,
      });
    set[id](true);
    setOpened({
        ...opened,
        [id]: opened,
      });
    set[id](opened);

    if (typeof item.onToggle === "function") {
      item.onToggle(opened);
    }
  }, [opened, everOpened]);
    const renderItemHandler = useCallback((item: AccordionItem) => {
    const {
      buttons,
      className = "",
      component: ItemComponent,
      componentProps = {},
      contentClassName = "",
      header,
      id,
    } = item;
    const headerId = `${id}-header`;
    const opened = opened[id];
    let itemContent;

    // Only render content if the accordion item is open or has been opened once
    // before. This saves us rendering complex components when users are keeping
    // them closed (e.g. in Inspector/Layout) or may not open them at all.
    if (everOpened[id]) {
      if (typeof ItemComponent === "function") {
        itemContent = <ItemComponent {...componentProps} />;
      } else if (typeof ItemComponent === "object") {
        itemContent = ItemComponent;
      }
    }

    return (
      <li
        key={id}
        id={id}
        className={`accordion-item ${className}`.trim()}
        aria-labelledby={headerId}
      >
        <h2
          id={headerId}
          className="accordion-header"
          tabIndex={0}
          aria-expanded={opened}
          // If the header contains buttons, make sure the heading name only
          // contains the "header" text and not the button text
          aria-label={header}
          onKeyDown={onHeaderKeyDownHandler}
          onClick={onHeaderClickHandler}
        >
          <span className={`theme-twisty${opened ? " open" : ""}`} role="presentation" />
          <span className="accordion-header-label">{header}</span>
          {buttons && (
            <span className="accordion-header-buttons" role="presentation">
              {buttons}
            </span>
          )}
        </h2>
        <div
          className={`accordion-content ${contentClassName}`.trim()}
          hidden={!opened}
          role="presentation"
        >
          {itemContent}
        </div>
      </li>
    );
  }, [opened, everOpened]);

    return (
      <ul className="accordion" style={props.style} tabIndex={-1}>
        {props.items.map((item: AccordionItem) => renderItemHandler(item))}
      </ul>
    ); 
};

/**
   * Add initial data to the state.opened map, and inject new data
   * when receiving updated props.
   */
    Accordion.getDerivedStateFromProps = (props: AccordionProps, state: AccordionState) => {
    const newItems = props.items.filter(({ id }) => typeof state.opened[id] !== "boolean");

    if (newItems.length) {
      const everOpened = { ...state.everOpened };
      const opened = { ...state.opened };
      for (const item of newItems) {
        everOpened[item.id] = item.opened;
        opened[item.id] = item.opened;
      }
      return { everOpened, opened };
    }

    return null;
  };


export default Accordion;
