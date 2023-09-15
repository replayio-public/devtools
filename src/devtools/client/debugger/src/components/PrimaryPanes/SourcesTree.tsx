/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

// Dependencies

import { useEffect, useState, useCallback } from "react";
import { ConnectedProps, connect } from "react-redux";

import { focusItem, setExpandedState } from "devtools/client/debugger/src/actions/source-tree";
import { selectSource } from "devtools/client/debugger/src/actions/sources/select";
// Selectors
import { getContext } from "devtools/client/debugger/src/reducers/pause";
import {
    getExpandedState,
    getFocusedSourceItem,
} from "devtools/client/debugger/src/reducers/source-tree";
import { getShownSource } from "devtools/client/debugger/src/reducers/ui";
import { useNag } from "replay-next/src/hooks/useNag";
import { Nag } from "shared/graphql/types";
import {
    SourceDetails,
    getSelectedSource,
    getSourceDetailsCount,
    getSourcesLoading,
    getSourcesToDisplayByUrl,
} from "ui/reducers/sources";
import type { UIState } from "ui/state";
import { trackEvent } from "ui/utils/telemetry";

// Utils
import {
    SourcesMap,
    createTree,
    getDirectories,
    getSourceFromNode,
    isDirectory,
    nodeHasChildren
} from "../../utils/sources-tree";
import { TreeDirectory, TreeNode } from "../../utils/sources-tree/types";
import ManagedTree from "../shared/ManagedTree";
// Components
import SourcesTreeItem from "./SourcesTreeItem";

type $FixTypeLater = any;

function shouldAutoExpand(depth: number, item: TreeNode) {
  if (depth !== 1) {
    return false;
  }

  return item.name === "";
}

function findSource(sourcesByUrl: Record<string, SourceDetails>, source: SourceDetails) {
  if (source) {
    return sourcesByUrl[source.url!];
  }
  return source;
}

const mapStateToProps = (state: UIState) => {
  const selectedSource = getSelectedSource(state);
  const shownSource = getShownSource(state);
  const sources = getSourcesToDisplayByUrl(state) as Record<string, SourceDetails>;

  return {
    cx: getContext(state),
    sourcesLoading: getSourcesLoading(state),
    shownSource: shownSource,
    selectedSource: selectedSource,
    expanded: getExpandedState(state),
    focused: getFocusedSourceItem(state),
    sources,
    sourceCount: getSourceDetailsCount(state),
  };
};

const connector = connect(mapStateToProps, {
  selectSource,
  setExpandedState,
  focusItem,
});

type PropsFromRedux = ConnectedProps<typeof connector>;

interface STState {
  uncollapsedTree: TreeDirectory;
  sourceTree: TreeNode;
  parentMap: WeakMap<object, any>;
  listItems?: TreeNode[];
  highlightItems?: TreeNode[];
}

const SourcesTree = (props: PropsFromRedux) => {
const { sources } = props;
    const state = createTree({
      sources: sources as SourcesMap,
    }) as STState;
    const listItems = getDirectories(props.shownSource, state.sourceTree as TreeDirectory);
    const highlightItems = getDirectories(
        props.selectedSource,
        state.sourceTree as TreeDirectory
      );

    const [uncollapsedTree, setUncollapsedTree] = useState<TreeDirectory | undefined>(undefined);
    const [sourceTree, setSourceTree] = useState<TreeNode | undefined>(undefined);
    const [parentMap, setParentMap] = useState<WeakMap<object, any> | undefined>(undefined);
    const [listItems, setListItems] = useState<TreeNode[] | undefined>(undefined);
    const [highlightItems, setHighlightItems] = useState<TreeNode[] | undefined>(undefined);

    const UNSAFE_componentWillReceivePropsHandler = useCallback((nextProps: PropsFromRedux) => {
    const { sources, shownSource, selectedSource } = props;
    

    if (nextProps.shownSource && nextProps.shownSource != shownSource) {
      const listItems = getDirectories(nextProps.shownSource, sourceTree as TreeDirectory);
      return setListItems(listItems);;
    }

    if (nextProps.selectedSource && nextProps.selectedSource != selectedSource) {
      const highlightItems = getDirectories(nextProps.selectedSource, sourceTree as TreeDirectory);
      setHighlightItems(highlightItems);
    }

    // NOTE: do not run this every time a source is clicked,
    // only when a new source is added
    if (nextProps.sources != props.sources) {
      setDebuggeeUrl("");
    setNewSources(nextProps.sources);
    setPrevSources(sources);
    setUncollapsedTree(uncollapsedTree);
    setSourceTree(sourceTree);
    }
  }, [listItems, sourceTree, highlightItems, uncollapsedTree]);
    const selectItemHandler = useCallback((item: TreeNode | undefined) => {
    if (item && item.type == "source" && !Array.isArray(item.contents)) {
      trackEvent("source_explorer.select_source");
      props.selectSource(props.cx, item.contents.id);
    }
  }, []);
    const onFocusHandler = useCallback((item: TreeNode | undefined) => {
    props.focusItem(item);
  }, []);
    const onActivateHandler = useCallback((item: TreeNode | undefined) => {
    selectItemHandler(item);
  }, []);
    // NOTE: we get the source from sources because item.contents is cached
    const getSourceHandler = useCallback((item: TreeNode) => {
    const source = getSourceFromNode(item);
    return findSource(props.sources, source!);
  }, []);
    const getPathHandler = useCallback((item: TreeNode) => {
    const { path } = item;
    const source = getSourceHandler(item);

    if (!source || isDirectory(item)) {
      return path;
    }

    return `${path}/${source.id}/`;
  }, []);
    const getKeyHandler = useCallback((item: TreeNode) => {
    const { path } = item;
    const source = getSourceHandler(item);

    if (item.type === "source" && source) {
      // Probably overkill
      return `${source.url!}${source.contentId || ""}${source.id}`;
    }

    return path;
  }, []);
    const onExpandHandler = useCallback((item: TreeNode, expandedState: $FixTypeLater) => {
    props.setExpandedState(expandedState);
  }, []);
    const onCollapseHandler = useCallback((item: TreeNode, expandedState: $FixTypeLater) => {
    props.setExpandedState(expandedState);
  }, []);
    const isEmptyHandler = useCallback(() => {
    
    if (!Array.isArray(sourceTree.contents)) {
      return true;
    }
    return sourceTree.contents.length === 0;
  }, [sourceTree]);
    const renderEmptyElementHandler = useCallback((message: string) => {
    return (
      <div key="empty" className="no-sources-message">
        {message}
      </div>
    );
  }, []);
    const getRootsHandler = useCallback((sourceTree: TreeNode) => {
    return sourceTree.contents as TreeNode[];
  }, [sourceTree]);
    const getChildrenHandler = useCallback((item: TreeNode) => {
    return nodeHasChildren(item) ? (item.contents as TreeNode[]) : [];
  }, []);
    const renderItemHandler = useCallback((
    item: TreeNode,
    depth: number,
    focused: boolean,
    _: any,
    expanded: boolean,
    { setExpanded }: { setExpanded: (item: TreeNode) => void }
  ) => {
    return (
      <SourcesTreeItem
        item={item}
        depth={depth}
        focused={focused}
        autoExpand={shouldAutoExpand(depth, item)}
        expanded={expanded}
        focusItem={onFocusHandler}
        selectItem={selectItemHandler}
        source={getSourceHandler(item)}
        debuggeeUrl={""}
        setExpanded={setExpanded}
      />
    );
  }, []);
    const renderTree = useMemo(() => {
    const { expanded, focused } = props;

    

    return (
      <ManagedTree<TreeNode>
        autoExpandAll={false}
        autoExpandDepth={1}
        expanded={expanded}
        focused={focused as any}
        getChildren={getChildrenHandler}
        getParent={(item: TreeNode) => parentMap.get(item)}
        getPath={getPathHandler}
        getKey={getKeyHandler}
        getRoots={() => getRootsHandler(sourceTree)}
        highlightItems={highlightItems}
        key={isEmptyHandler() ? "empty" : "full"}
        listItems={listItems}
        onCollapse={onCollapseHandler}
        onExpand={onExpandHandler}
        onFocus={onFocusHandler}
        onActivate={onActivateHandler}
        renderItem={renderItemHandler}
        preventBlur={true}
      />
    );
  }, [parentMap, sourceTree, highlightItems, listItems]);

    const { sourcesLoading } = props;
    if (sourcesLoading) {
      return (
        <div key="pane" className="sources-pane">
          {renderEmptyElementHandler("Sources are loading.")}
        </div>
      );
    }

    if (isEmptyHandler()) {
      return (
        <div key="pane" className="sources-pane">
          {renderEmptyElementHandler("This page has no sources.")}
        </div>
      );
    }

    return (
      <div key="pane" className="sources-pane">
        <div key="tree" className="sources-list">
          {renderTree()}
        </div>
      </div>
    ); 
};




const WrappedSourcesTree = (props: PropsFromRedux) => {
  const [ dismissExploreSourcesNag] = useNag(Nag.EXPLORE_SOURCES);

  useEffect(() => {
    dismissExploreSourcesNag();
  }, [dismissExploreSourcesNag]);

  // Directly pass the props down to SourcesTree without destructuring
  return <SourcesTree {...props} />;
};

export default connector(WrappedSourcesTree);
