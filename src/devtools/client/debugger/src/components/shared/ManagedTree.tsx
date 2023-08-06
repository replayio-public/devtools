/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import React, { useState, useCallback } from "react";

import { Tree, TreeProps } from "./tree";

export interface ManagedTreeProps<T extends { name: string }>
  extends Omit<TreeProps<T>, "renderItem" | "onExpand" | "onCollapse" | "isExpanded" | "getKey"> {
  expanded?: Set<string>;
  getPath: (item: T) => string;
  getKey?: (item: T) => string;
  listItems?: T[];
  highlightItems?: T[];
  focused?: T;
  onFocus: (item: T | undefined) => void;
  onExpand?: (item: T, expanded: Set<string>) => void;
  onCollapse?: (item: T, expanded: Set<string>) => void;
  renderItem: (
    item: T,
    depth: number,
    isFocused: boolean,
    arrow: React.ReactNode,
    isExpanded: boolean,
    { setExpanded }: { setExpanded: () => void }
  ) => React.ReactNode;
}

interface ManagedTreeState {
  expanded: Set<string>;
}

const ManagedTree = (inputProps: ManagedTreeProps<T>) => {
const expanded = props.expanded || new Set();
    const index = props.highlightItems
          .reverse()
          .findIndex(item => !expanded.has(props.getPath(item)) && item.name !== "root");

    const [expanded, setExpanded] = useState<Set<string> | undefined>(undefined);

    const props = { 
    onFocus: () => {},
    ...inputProps,
  };
    const UNSAFE_componentWillReceivePropsHandler = useCallback((nextProps: ManagedTreeProps<T>) => {
    const { listItems, highlightItems } = props;
    if (nextProps.listItems && nextProps.listItems != listItems) {
      expandListItemsHandler(nextProps.listItems);
    }

    if (
      nextProps.highlightItems &&
      nextProps.highlightItems != highlightItems &&
      nextProps.highlightItems.length
    ) {
      highlightItemHandler(nextProps.highlightItems);
    }
  }, []);
    const setExpandedHandler = useCallback((item: T, isExpanded: boolean) => {
    const expandItem = (item: T) => {
      const path = props.getPath(item);
      if (isExpanded) {
        expanded.add(path);
      } else {
        expanded.delete(path);
      }
    };
    
    expandItem(item);

    setExpanded(expanded);

    if (isExpanded && props.onExpand) {
      props.onExpand(item, expanded);
    } else if (!isExpanded && props.onCollapse) {
      props.onCollapse(item, expanded);
    }
  }, [expanded]);
    const expandListItemsHandler = useCallback((listItems: T[]) => {
    
    listItems.forEach(item => expanded.add(props.getPath(item)));
    props.onFocus(listItems[0]);
    setExpanded(expanded);
  }, [expanded]);
    const highlightItemHandler = useCallback((highlightItems: T[]) => {
    
    // This file is visible, so we highlight it.
    if (expanded.has(props.getPath(highlightItems[0]))) {
      props.onFocus(highlightItems[0]);
    } else {
      // Look at folders starting from the top-level until finds a
      // closed folder and highlights this folder
      const index = highlightItems
        .reverse()
        .findIndex(item => !expanded.has(props.getPath(item)) && item.name !== "root");

      if (highlightItems[index]) {
        props.onFocus(highlightItems[index]);
      }
    }
  }, [expanded]);

    
    return (
      <div className="managed-tree">
        <Tree<any>
          {...props}
          isExpanded={(item: T) => expanded.has(props.getPath(item))}
          focused={props.focused}
          getKey={props.getKey ?? props.getPath}
          onExpand={(item: T) => setExpandedHandler(item, true)}
          onCollapse={(item: T) => setExpandedHandler(item, false)}
          onFocus={props.onFocus}
          renderItem={(...args: any[]) =>
            // @ts-expect-error some spread complaint
            props.renderItem(...args, {
              setExpanded: setExpandedHandler,
            })
          }
        />
      </div>
    ); 
};




export default ManagedTree;
