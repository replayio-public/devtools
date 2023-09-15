/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */


import classnames from "classnames";
import PropTypes from "prop-types";
import React, { useRef, useEffect, useCallback, useState } from 'react';

export interface TreeProps<T> {
  getParent: (item: T) => T | undefined;
  getChildren: (item: T) => T[];
  areItemsEqual?: (item1: T, item2: T) => boolean;
  shouldItemUpdate?: (prevItem: T, nextItem: T) => boolean;
  renderItem: (
    item: T,
    depth: number,
    isFocused: boolean,
    arrow: ReactNode,
    isExpanded: boolean
  ) => ReactNode;
  getRoots: () => T[];
  getKey: (item: T) => string;
  isExpanded: (item: T) => boolean;
  focused?: T;
  onFocus?: (item: T | undefined) => void;
  autoExpandDepth?: number;
  autoExpandAll?: boolean;
  autoExpandNodeChildrenLimit?: number;
  initiallyExpanded?: (item: T) => boolean;
  labelledby?: string;
  label?: string;
  onExpand?: (item: T) => void;
  onCollapse?: (item: T) => void;
  active?: T;
  onActivate?: (item: T | undefined) => void;
  isExpandable?: (item: T) => boolean;
  className?: string;
  style?: React.CSSProperties;
  preventBlur?: boolean;
}

interface TreeState {
  autoExpanded: Set<string>;
}

interface DFSTraversalEntry {
  item: any;
  depth: number;
}

// depth
const AUTO_EXPAND_DEPTH = 0;

// Simplied selector targetting elements that can receive the focus,
// full version at https://stackoverflow.com/questions/1599660.
const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "iframe:not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * An arrow that displays whether its node is expanded (▼) or collapsed
 * (▶). When its node has no children, it is hidden.
 */
function ArrowExpander({ expanded }: { expanded: boolean }) {
  return <button className={classnames("arrow", { expanded })} />;
}

const INDENT_CHARACTER = "\u200B";
const treeIndent = <span className="tree-indent">{INDENT_CHARACTER}</span>;
const treeLastIndent = <span className="tree-indent tree-last-indent">{INDENT_CHARACTER}</span>;

interface TreeNodeProps<T> {
  id: string;
  index: number;
  depth: number;
  focused: boolean;
  active: boolean;
  expanded: boolean;
  item: T;
  isExpandable: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  areItemsEqual?: (a: T, b: T) => boolean;
  shouldItemUpdate?: (a: T, b: T) => boolean;
  renderItem: (
    item: T,
    depth: number,
    focused: boolean,
    arrow: React.ReactNode,
    expanded: boolean
  ) => React.ReactNode;
}

const TreeNode = (props: TreeNodeProps<T>) => {


    

    const treeNodeRef = useRef<HTMLDivElement>();
    useEffect(() => {
    // Make sure that none of the focusable elements inside the tree node
    // container are tabbable if the tree node is not active. If the tree node
    // is active and focus is outside its container, focus on the first
    // focusable element inside.
    const elms = getFocusableElementsHandler();
    if (props.active) {
      const doc = treeNodeRef.current!.ownerDocument;
      if (elms.length > 0 && !elms.includes(doc.activeElement as any)) {
        elms[0].focus();
      }
    } else {
      elms.forEach(elm => elm.setAttribute("tabindex", "-1"));
    }
  }, []);
    const shouldComponentUpdateHandler = useCallback((nextProps: TreeNodeProps<T>) => {
    return (
      !_areItemsEqualHandler(props.item, nextProps.item) ||
      (props.shouldItemUpdate &&
        props.shouldItemUpdate(props.item, nextProps.item)) ||
      props.focused !== nextProps.focused ||
      props.expanded !== nextProps.expanded
    );
  }, []);
    const _areItemsEqualHandler = useCallback((prevItem: any, nextItem: any) => {
    if (props.areItemsEqual && prevItem && nextItem) {
      return props.areItemsEqual(prevItem, nextItem);
    } else {
      return prevItem === nextItem;
    }
  }, []);
    /**
   * Get a list of all elements that are focusable with a keyboard inside the
   * tree node.
   */
    const getFocusableElementsHandler = useCallback(() => {
    return treeNodeRef.current
      ? (Array.from(treeNodeRef.current.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
      : [];
  }, []);
    /**
   * Wrap and move keyboard focus to first/last focusable element inside the
   * tree node to prevent the focus from escaping the tree node boundaries.
   * element).
   *
   * @param  {DOMNode} current  currently focused element
   * @param  {Boolean} back     direction
   * @return {Boolean}          true there is a newly focused element.
   */
    const _wrapMoveFocusHandler = useCallback((current: HTMLElement, back: boolean) => {
    const elms = getFocusableElementsHandler();
    let next;

    if (elms.length === 0) {
      return false;
    }

    if (back) {
      if (elms.indexOf(current) === 0) {
        next = elms[elms.length - 1];
        next.focus();
      }
    } else if (elms.indexOf(current) === elms.length - 1) {
      next = elms[0];
      next.focus();
    }

    return !!next;
  }, []);
    const _onKeyDownHandler = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const { target, key, shiftKey } = e;

    if (key !== "Tab") {
      return;
    }

    const focusMoved = _wrapMoveFocusHandler(target as HTMLElement, shiftKey);
    if (focusMoved) {
      // Focus was moved to the begining/end of the list, so we need to prevent
      // the default focus change that would happen here.
      e.preventDefault();
    }

    e.stopPropagation();
  }, []);

    const { depth, id, item, focused, active, expanded, renderItem, isExpandable } = props;

    const arrow = isExpandable ? <ArrowExpander expanded={expanded} /> : null;

    let ariaExpanded;
    if (props.isExpandable) {
      ariaExpanded = false;
    }
    if (props.expanded) {
      ariaExpanded = true;
    }

    const indents: React.ReactNode[] = Array.from({ length: depth }, (_, i) => {
      if (i == depth - 1) {
        return treeLastIndent;
      }
      return treeIndent;
    });

    // Handle "needs keys" warnings for the indentation
    const items = indents
      .concat(renderItem(item, depth, focused, arrow, expanded))
      .map((element, i) => React.cloneElement(element as JSX.Element, { key: i }));

    return (
      <div
        id={id}
        className={`tree-node${focused ? " focused" : ""}${active ? " active" : ""}`}
        onClick={props.onClick}
        onKeyDownCapture={active ? _onKeyDownHandler : undefined}
        role="treeitem"
        ref={treeNodeRef.current}
        aria-level={depth + 1}
        aria-expanded={ariaExpanded}
        data-expandable={props.isExpandable}
      >
        {items}
      </div>
    ); 
};

TreeNode.propTypes = () => {
    return {
      id: PropTypes.any.isRequired,
      index: PropTypes.number.isRequired,
      depth: PropTypes.number.isRequired,
      focused: PropTypes.bool.isRequired,
      active: PropTypes.bool.isRequired,
      expanded: PropTypes.bool.isRequired,
      item: PropTypes.any.isRequired,
      isExpandable: PropTypes.bool.isRequired,
      onClick: PropTypes.func,
      areItemsEqual: PropTypes.func,
      shouldItemUpdate: PropTypes.func,
      renderItem: PropTypes.func.isRequired,
    };
  };


/**
 * A generic tree component. See propTypes for the public API.
 *
 * This tree component doesn't make any assumptions about the structure of your
 * tree data. Whether children are computed on demand, or stored in an array in
 * the parent's `_children` property, it doesn't matter. We only require the
 * implementation of `getChildren`, `getRoots`, `getParent`, and `isExpanded`
 * functions.
 *
 * This tree component is well tested and reliable. See the tests in ./tests
 * and its usage in the performance and memory panels in mozilla-central.
 *
 * This tree component doesn't make any assumptions about how to render items in
 * the tree. You provide a `renderItem` function, and this component will ensure
 * that only those items whose parents are expanded and which are visible in the
 * viewport are rendered. The `renderItem` function could render the items as a
 * "traditional" tree or as rows in a table or anything else. It doesn't
 * restrict you to only one certain kind of tree.
 *
 * The tree comes with basic styling for the indent, the arrow, as well as
 * hovered and focused styles which can be override in CSS.
 *
 * ### Example Usage
 *
 * Suppose we have some tree data where each item has this form:
 *
 *     {
 *       id: Number,
 *       label: String,
 *       parent: Item or null,
 *       children: Array of child items,
 *       expanded: bool,
 *     }
 *
 * Here is how we could render that data with this component:
 *
 *     class MyTree extends Component {
 *       static get propTypes() {
 *         // The root item of the tree, with the form described above.
 *         return {
 *           root: PropTypes.object.isRequired
 *         };
 *       },
 *
 *       render() {
 *         return Tree({
 *           itemHeight: 20, // px
 *
 *           getRoots: () => [this.props.root],
 *
 *           getParent: item => item.parent,
 *           getChildren: item => item.children,
 *           getKey: item => item.id,
 *           isExpanded: item => item.expanded,
 *
 *           renderItem: (item, depth, isFocused, arrow, isExpanded) => {
 *             let className = "my-tree-item";
 *             if (isFocused) {
 *               className += " focused";
 *             }
 *             return dom.div({
 *               className,
 *             },
 *               arrow,
 *               // And here is the label for this item.
 *               dom.span({ className: "my-tree-item-label" }, item.label)
 *             );
 *           },
 *
 *           onExpand: item => dispatchExpandActionToRedux(item),
 *           onCollapse: item => dispatchCollapseActionToRedux(item),
 *         });
 *       }
 *     }
 */
export export const Tree = (props: TreeProps<T>) => {


    const [autoExpanded, setAutoExpanded] = useState(new Set<string>());

    const treeRef = useRef<HTMLDivElement>();
    useEffect(() => {
    _autoExpandHandler();
    if (props.focused) {
      _scrollNodeIntoViewHandler(props.focused);
    }
  }, []);
    const UNSAFE_componentWillReceivePropsHandler = useCallback(() => {
    _autoExpandHandler();
  }, []);
    useEffect(() => {
    if (props.focused && !_areItemsEqualHandler(prevProps.focused, props.focused)) {
      _scrollNodeIntoViewHandler(props.focused);
    }
  }, []);
    const _areItemsEqualHandler = useCallback((prevItem: any, nextItem: any) => {
    if (props.areItemsEqual && prevItem && nextItem) {
      return props.areItemsEqual(prevItem, nextItem);
    } else {
      return prevItem === nextItem;
    }
  }, []);
    const _autoExpandHandler = useCallback(() => {
    const { autoExpandDepth, autoExpandNodeChildrenLimit, initiallyExpanded } = props;

    if (!autoExpandDepth && !initiallyExpanded) {
      return;
    }

    // Automatically expand the first autoExpandDepth levels for new items. Do
    // not use the usual DFS infrastructure because we don't want to ignore
    // collapsed nodes. Any initially expanded items will be expanded regardless
    // of how deep they are.
    const autoExpand = (item: any, currentDepth: number) => {
      const initial = initiallyExpanded && initiallyExpanded(item);

      if (!initial && currentDepth >= autoExpandDepth!) {
        return;
      }

      const children = props.getChildren(item);
      if (
        !initial &&
        autoExpandNodeChildrenLimit &&
        children.length > autoExpandNodeChildrenLimit
      ) {
        return;
      }

      if (!autoExpanded.has(item)) {
        props.onExpand?.(item);
        autoExpanded.add(item);
      }

      const length = children.length;
      for (let i = 0; i < length; i++) {
        autoExpand(children[i], currentDepth + 1);
      }
    };

    const roots = props.getRoots();
    const length = roots.length;
    if (props.autoExpandAll) {
      for (let i = 0; i < length; i++) {
        autoExpand(roots[i], 0);
      }
    } else if (length != 0) {
      autoExpand(roots[0], 0);

      if (initiallyExpanded) {
        for (let i = 1; i < length; i++) {
          if (initiallyExpanded(roots[i])) {
            autoExpand(roots[i], 0);
          }
        }
      }
    }
  }, [autoExpanded]);
    const _preventArrowKeyScrollingHandler = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        _preventEventHandler(e);
        break;
    }
  }, []);
    const _preventEventHandler = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      if (e.nativeEvent.preventDefault) {
        e.nativeEvent.preventDefault();
      }
      if (e.nativeEvent.stopPropagation) {
        e.nativeEvent.stopPropagation();
      }
    }
  }, []);
    /**
   * Perform a pre-order depth-first search from item.
   */
    const _dfsHandler = useCallback((item: any, maxDepth = Infinity, traversal: DFSTraversalEntry[] = [], _depth = 0) => {
    traversal.push({ item, depth: _depth });

    if (!props.isExpanded(item)) {
      return traversal;
    }

    const nextDepth = _depth + 1;

    if (nextDepth > maxDepth) {
      return traversal;
    }

    const children = props.getChildren(item);
    const length = children.length;
    for (let i = 0; i < length; i++) {
      _dfsHandler(children[i], maxDepth, traversal, nextDepth);
    }

    return traversal;
  }, []);
    /**
   * Perform a pre-order depth-first search over the whole forest.
   */
    const _dfsFromRootsHandler = useCallback((maxDepth = Infinity) => {
    const traversal: DFSTraversalEntry[] = [];

    const roots = props.getRoots();
    const length = roots.length;
    for (let i = 0; i < length; i++) {
      _dfsHandler(roots[i], maxDepth, traversal);
    }

    return traversal;
  }, []);
    const _onExpandHandler = useCallback((item: any, expandAllChildren?: boolean) => {
    if (props.onExpand) {
      props.onExpand(item);

      if (expandAllChildren) {
        const children = _dfsHandler(item);
        const length = children.length;
        for (let i = 0; i < length; i++) {
          props.onExpand(children[i].item);
        }
      }
    }
  }, []);
    const _onCollapseHandler = useCallback((item: any) => {
    if (props.onCollapse) {
      props.onCollapse(item);
    }
  }, []);
    const _focusHandler = useCallback((item: any, options: { preventAutoScroll?: boolean } = {}) => {
    const { preventAutoScroll } = options;
    if (item && !preventAutoScroll) {
      _scrollNodeIntoViewHandler(item);
    }

    if (props.active != undefined) {
      _activateHandler(undefined);
      const doc = treeRef.current && treeRef.current.ownerDocument;
      if (treeRef.current !== doc?.activeElement) {
        treeRef.current!.focus();
      }
    }

    if (props.onFocus) {
      props.onFocus(item);
    }
  }, []);
    const _activateHandler = useCallback((item: any) => {
    if (props.onActivate) {
      props.onActivate(item);
    }
  }, []);
    const _scrollNodeIntoViewHandler = useCallback((item: any) => {
    if (item !== undefined) {
      const treeElement = treeRef.current;
      const doc = treeElement && treeElement.ownerDocument;
      const element = doc?.getElementById(props.getKey(item));

      if (element) {
        const { top, bottom } = element.getBoundingClientRect();
        const closestScrolledParent = (node: HTMLElement | null): HTMLElement | null => {
          if (node == null) {
            return null;
          }

          if (node.scrollHeight > node.clientHeight) {
            return node;
          }
          return closestScrolledParent(node.parentNode as HTMLElement);
        };

        const scrolledParentRect = treeElement?.getBoundingClientRect();
        const isVisible =
          !treeElement || (top >= scrolledParentRect!.top && bottom <= scrolledParentRect!.bottom);

        if (isVisible) {
          return;
        }

        element.scrollIntoView({ block: "center" });
      }
    }
  }, []);
    const _onBlurHandler = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (props.active != undefined) {
      const { relatedTarget } = e;
      if (!treeRef.current!.contains(relatedTarget as any)) {
        _activateHandler(undefined);
      }
    } else if (!props.preventBlur) {
      _focusHandler(undefined);
    }
  }, []);
    const _onKeyDownHandler = useCallback((e: React.KeyboardEvent) => {
    if (props.focused == null) {
      return;
    }

    // Allow parent nodes to use navigation arrows with modifiers.
    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
      return;
    }

    _preventArrowKeyScrollingHandler(e);
    const doc = treeRef.current && treeRef.current.ownerDocument;

    switch (e.key) {
      case "ArrowUp":
        _focusPrevNodeHandler();
        return;

      case "ArrowDown":
        _focusNextNodeHandler();
        return;

      case "ArrowLeft":
        if (
          props.isExpanded(props.focused) &&
          _nodeIsExpandableHandler(props.focused)
        ) {
          _onCollapseHandler(props.focused);
        } else {
          _focusParentNodeHandler();
        }
        return;

      case "ArrowRight":
        if (
          _nodeIsExpandableHandler(props.focused) &&
          !props.isExpanded(props.focused)
        ) {
          _onExpandHandler(props.focused);
        } else {
          _focusNextNodeHandler();
        }
        return;

      case "Home":
        _focusFirstNodeHandler();
        return;

      case "End":
        _focusLastNodeHandler();
        return;

      case "Enter":
      case "NumpadEnter":
      case " ":
        if (treeRef.current === doc!.activeElement) {
          _preventEventHandler(e);
          if (!_areItemsEqualHandler(props.active, props.focused)) {
            _activateHandler(props.focused);
          }
        }
        return;

      case "Escape":
        _preventEventHandler(e);
        if (props.active != undefined) {
          _activateHandler(undefined);
        }

        if (treeRef.current !== doc!.activeElement) {
          treeRef.current!.focus();
        }
    }
  }, []);
    const _focusPrevNodeHandler = useCallback(() => {
    // Start a depth first search and keep going until we reach the currently
    // focused node. Focus the previous node in the DFS, if it exists. If it
    // doesn't exist, we're at the first node already.

    let prev;

    const traversal = _dfsFromRootsHandler();
    const length = traversal.length;
    for (let i = 0; i < length; i++) {
      const item = traversal[i].item;
      if (_areItemsEqualHandler(item, props.focused)) {
        break;
      }
      prev = item;
    }
    if (prev === undefined) {
      return;
    }

    _focusHandler(prev);
  }, []);
    const _focusNextNodeHandler = useCallback(() => {
    // Start a depth first search and keep going until we reach the currently
    // focused node. Focus the next node in the DFS, if it exists. If it
    // doesn't exist, we're at the last node already.
    const traversal = _dfsFromRootsHandler();
    const length = traversal.length;
    let i = 0;

    while (i < length) {
      if (_areItemsEqualHandler(traversal[i].item, props.focused)) {
        break;
      }
      i++;
    }

    if (i + 1 < traversal.length) {
      _focusHandler(traversal[i + 1].item);
    }
  }, []);
    const _focusParentNodeHandler = useCallback(() => {
    const parent = props.getParent(props.focused!);
    if (!parent) {
      _focusPrevNodeHandler();
      return;
    }

    _focusHandler(parent);
  }, []);
    const _focusFirstNodeHandler = useCallback(() => {
    const traversal = _dfsFromRootsHandler();
    _focusHandler(traversal[0].item);
  }, []);
    const _focusLastNodeHandler = useCallback(() => {
    const traversal = _dfsFromRootsHandler();
    const lastIndex = traversal.length - 1;
    _focusHandler(traversal[lastIndex].item);
  }, []);
    const _nodeIsExpandableHandler = useCallback((item: any) => {
    return props.isExpandable
      ? props.isExpandable(item)
      : !!props.getChildren(item).length;
  }, []);

    const traversal = _dfsFromRootsHandler();
    const { active, focused } = props;

    const nodes = traversal.map((v, i) => {
      const { item, depth } = v;
      const key = props.getKey(item);
      return (
        <TreeNode<any>
          // We make a key unique depending on whether the tree node is in active
          // or inactive state to make sure that it is actually replaced and the
          // tabbable state is reset.
          key={`${key}-${_areItemsEqualHandler(active, item) ? "active" : "inactive"}`}
          id={key}
          index={i}
          item={item}
          depth={depth}
          areItemsEqual={props.areItemsEqual}
          shouldItemUpdate={props.shouldItemUpdate}
          renderItem={props.renderItem}
          focused={_areItemsEqualHandler(focused, item)}
          active={_areItemsEqualHandler(active, item)}
          expanded={props.isExpanded(item)}
          isExpandable={_nodeIsExpandableHandler(item)}
          onClick={(e: React.MouseEvent) => {
            // We can stop the propagation since click handler on the node can be
            // created in `renderItem`.
            e.stopPropagation();

            if (e.defaultPrevented) {
              return;
            }

            // Since the user just clicked the node, there's no need to check if
            // it should be scrolled into view.
            _focusHandler(item, { preventAutoScroll: true });
            if (props.isExpanded(item)) {
              props.onCollapse?.(item);
            } else {
              props.onExpand?.(item);
            }

            // Focus should always remain on the tree container itself.
            treeRef.current!.focus();
          }}
        />
      );
    });
    const style = Object.assign({}, props.style || {});

    return (
      <div
        className={`tree ${props.className ? props.className : ""}`}
        ref={treeRef.current}
        role="tree"
        tabIndex={0}
        onKeyDown={_onKeyDownHandler}
        onKeyPress={_preventArrowKeyScrollingHandler}
        onKeyUp={_preventArrowKeyScrollingHandler}
        onFocus={({ nativeEvent }: React.FocusEvent) => {
          if (focused || !nativeEvent || !treeRef.current) {
            return;
          }

          // @ts-expect-error
          const { explicitOriginalTarget } = nativeEvent;
          // Only set default focus to the first tree node if the focus came
          // from outside the tree (e.g. by tabbing to the tree from other
          // external elements).
          if (
            explicitOriginalTarget !== treeRef.current &&
            !treeRef.current.contains(explicitOriginalTarget)
          ) {
            _focusHandler(traversal[0].item);
          }
        }}
        onBlur={_onBlurHandler}
        aria-label={props.label}
        aria-labelledby={props.labelledby}
        aria-activedescendant={focused && props.getKey(focused)}
        style={style}
      >
        {nodes}
      </div>
    ); 
};

Tree.propTypes = () => {
    return {
      // Required props

      // A function to get an item's parent, or null if it is a root.
      //
      // Type: getParent(item: Item) -> Maybe<Item>
      //
      // Example:
      //
      //     // The parent of this item is stored in its `parent` property.
      //     getParent: item => item.parent
      getParent: PropTypes.func.isRequired,

      // A function to get an item's children.
      //
      // Type: getChildren(item: Item) -> [Item]
      //
      // Example:
      //
      //     // This item's children are stored in its `children` property.
      //     getChildren: item => item.children
      getChildren: PropTypes.func.isRequired,

      // A function to check if two items represent the same tree node.
      // Use this if the item representing a tree node may be replaced by
      // a new item and you don't want to rerender that node every time
      // the item is replaced. Use shouldItemUpdate() to control when the
      // node should be updated.
      //
      // Type: areItemsEqual(prevItem: Item, nextItem: Item) -> Boolean
      areItemsEqual: PropTypes.func,

      // A function to check if the tree node for the item should be updated.
      //
      // Type: shouldItemUpdate(prevItem: Item, nextItem: Item) -> Boolean
      //
      // Example:
      //
      //     // This item should be updated if it's type is a long string
      //     shouldItemUpdate: (prevItem, nextItem) =>
      //       nextItem.type === "longstring"
      shouldItemUpdate: PropTypes.func,

      // A function which takes an item and ArrowExpander component instance and
      // returns a component, or text, or anything else that React considers
      // renderable.
      //
      // Type: renderItem(item: Item,
      //                  depth: Number,
      //                  isFocused: Boolean,
      //                  arrow: ReactComponent,
      //                  isExpanded: Boolean) -> ReactRenderable
      //
      // Example:
      //
      //     renderItem: (item, depth, isFocused, arrow, isExpanded) => {
      //       let className = "my-tree-item";
      //       if (isFocused) {
      //         className += " focused";
      //       }
      //       return dom.div(
      //         {
      //           className,
      //           style: { marginLeft: depth * 10 + "px" }
      //         },
      //         arrow,
      //         dom.span({ className: "my-tree-item-label" }, item.label)
      //       );
      //     },
      renderItem: PropTypes.func.isRequired,

      // A function which returns the roots of the tree (forest).
      //
      // Type: getRoots() -> [Item]
      //
      // Example:
      //
      //     // In this case, we only have one top level, root item. You could
      //     // return multiple items if you have many top level items in your
      //     // tree.
      //     getRoots: () => [this.props.rootOfMyTree]
      getRoots: PropTypes.func.isRequired,

      // A function to get a unique key for the given item. This helps speed up
      // React's rendering a *TON*.
      //
      // Type: getKey(item: Item) -> String
      //
      // Example:
      //
      //     getKey: item => `my-tree-item-${item.uniqueId}`
      getKey: PropTypes.func.isRequired,

      // A function to get whether an item is expanded or not. If an item is not
      // expanded, then it must be collapsed.
      //
      // Type: isExpanded(item: Item) -> Boolean
      //
      // Example:
      //
      //     isExpanded: item => item.expanded,
      isExpanded: PropTypes.func.isRequired,

      // Optional props

      // The currently focused item, if any such item exists.
      focused: PropTypes.any,

      // Handle when a new item is focused.
      onFocus: PropTypes.func,

      // The depth to which we should automatically expand new items.
      autoExpandDepth: PropTypes.number,
      // Should auto expand all new items or just the new items under the first
      // root item.
      autoExpandAll: PropTypes.bool,

      // Auto expand a node only if number of its children
      // are less than autoExpandNodeChildrenLimit
      autoExpandNodeChildrenLimit: PropTypes.number,

      // Note: the two properties below are mutually exclusive. Only one of the
      // label properties is necessary.
      // ID of an element whose textual content serves as an accessible label
      // for a tree.
      labelledby: PropTypes.string,
      // Accessibility label for a tree widget.
      label: PropTypes.string,

      // Optional event handlers for when items are expanded or collapsed.
      // Useful for dispatching redux events and updating application state,
      // maybe lazily loading subtrees from a worker, etc.
      //
      // Type:
      //     onExpand(item: Item)
      //     onCollapse(item: Item)
      //
      // Example:
      //
      //     onExpand: item => dispatchExpandActionToRedux(item)
      onExpand: PropTypes.func,
      onCollapse: PropTypes.func,
      // The currently active (keyboard) item, if any such item exists.
      active: PropTypes.any,
      // Optional event handler called with the current focused node when the
      // Enter key is pressed. Can be useful to allow further keyboard actions
      // within the tree node.
      onActivate: PropTypes.func,
      isExpandable: PropTypes.func,
      // Additional classes to add to the root element.
      className: PropTypes.string,
      // style object to be applied to the root element.
      style: PropTypes.object,
      // Prevents blur when Tree loses focus
      preventBlur: PropTypes.bool,
    };
  };
    Tree.defaultProps = () => {
    return {
      autoExpandDepth: AUTO_EXPAND_DEPTH,
      autoExpandAll: true,
    };
  };

