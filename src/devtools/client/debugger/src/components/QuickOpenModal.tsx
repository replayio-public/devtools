/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */


import { Dictionary } from "@reduxjs/toolkit";
import fuzzyAldrin from "fuzzaldrin-plus";
import debounce from "lodash/debounce";
import memoizeOne from "memoize-one";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useImperativeCacheValue } from "suspense";

import { sourceOutlineCache } from "replay-next/src/suspense/SourceOutlineCache";
import { streamingSourceContentsCache } from "replay-next/src/suspense/SourcesCache";
import { replayClient } from "shared/client/ReplayClientContext";
import { ViewMode } from "shared/user-data/GraphQL/config";
import { setViewMode as setViewModeAction } from "ui/actions/layout";
import { getViewMode } from "ui/reducers/layout";
import {
    SourceDetails,
    getAllSourceDetails,
    getSelectedSource,
    getSourcesLoading,
    getSourcesToDisplayByUrl,
} from "ui/reducers/sources";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { trackEvent } from "ui/utils/telemetry";

import actions from "../actions";
import { PartialLocation } from "../actions/sources/select";
import { getGlobalFunctions, isGlobalFunctionsLoading } from "../reducers/ast";
import {
    Context,
    HighlightedRange,
    SearchTypes,
    Tab,
    getContext,
    getQuickOpenEnabled,
    getQuickOpenProject,
    getQuickOpenQuery,
    getQuickOpenType,
    getShowOnlyOpenSources,
    getSourcesForTabs,
    getTabs,
} from "../selectors";
import { basename } from "../utils/path";
import {
    SearchResult,
    formatShortcutResults, formatSymbols,
    parseLineColumn
} from "../utils/quick-open";
import Modal from "./shared/Modal";
import ResultList from "./shared/ResultList";
import SearchInput from "./shared/SearchInput";

const maxResults = 100;

const SIZE_BIG = { size: "big" };
const SIZE_DEFAULT = {};

export type SearchResultWithHighlighting = Omit<SearchResult, "title"> & {
  title: string | JSX.Element;
};

function filter(values: SearchResult[], query: string) {
  const preparedQuery = fuzzyAldrin.prepareQuery(query);

  return query
    ? fuzzyAldrin.filter(values, query, {
        key: "value",
        maxResults,
        preparedQuery,
      })
    : values;
}

interface QOMState {
  results: SearchResult[] | null;
  selectedIndex: number;
}

const QuickOpenModal = (props: QuickOpenModalProps) => {


    const [results, setResults] = useState(props.showOnlyOpenSources
        ? formatSources.current(props.sourcesToDisplayByUrl, props.tabs, false)
        : null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const resultList = useRef<ResultList>();
    const setResultsHandler = useCallback((results: SearchResult[]) => {
    if (results) {
      setResults(results.slice(0, maxResults));
    }
    setResults(results);
  }, [results]);
    useEffect(() => {
    const hasChanged = (field: keyof QuickOpenModalProps) => prevProps[field] !== props[field];

    resultList.current?.scrollList(selectedIndex);

    if (hasChanged("sourceCount")) {
      // If the source count has changed, we need to update the throttled
      // updateResults callback with the appropriate throttle duration.
      updateResults.current = getUpdateResultsCallbackHandler();
    }

    if (
      hasChanged("enabled") ||
      hasChanged("query") ||
      hasChanged("symbols") ||
      hasChanged("globalFunctions")
    ) {
      updateResults.current(props.query);
    }
  }, [selectedIndex]);
    const closeModalHandler = useCallback(() => {
    props.closeQuickOpen();
  }, []);
    const dropGotoHandler = useCallback((query: string) => {
    const index = query.indexOf(":");
    return index !== -1 ? query.slice(0, index) : query;
  }, []);
    const formatSources = useRef(memoizeOne(
    (
      sourcesToDisplayByUrl: Dictionary<SourceDetails>,
      tabs: { url: string }[],
      onlySourcesInTabs: boolean
    ) => {
      const tabUrls = new Set(tabs.map(tab => tab.url));
      return formatSources(sourcesToDisplayByUrl, tabUrls, onlySourcesInTabs);
    }
  ));
    const searchSourcesHandler = useCallback((query: string) => {
    const { tabs, showOnlyOpenSources, sourcesLoading, sourcesToDisplayByUrl } = props;

    if (sourcesLoading) {
      return null;
    }

    const sources = formatSources.current(sourcesToDisplayByUrl, tabs, showOnlyOpenSources);
    const results = query == "" ? sources : filter(sources, dropGotoHandler(query));
    return setResultsHandler(results);
  }, [results]);
    const getFunctionsHandler = useCallback(() => {
    const { project, symbols, globalFunctions } = props;

    return project ? globalFunctions || [] : symbols.functions;
  }, []);
    const searchFunctionsHandler = useCallback((query: string) => {
    let fns = getFunctionsHandler() as SearchResult[];

    if (query === "@" || query === "#") {
      return setResultsHandler(fns);
    }

    const filteredFns = filter(fns, query.slice(1));
    return setResultsHandler(filteredFns);
  }, []);
    const searchShortcutsHandler = useCallback((query: string) => {
    const results = formatShortcutResults();
    if (query == "?") {
      setResultsHandler(results);
    } else {
      setResultsHandler(filter(results, query.slice(1)));
    }
  }, [results]);
    const showTopSourcesHandler = useCallback(() => {
    const { tabs, sourcesToDisplayByUrl } = props;
    const tabUrls = new Set(tabs.map(tab => tab.url));
    setResultsHandler(formatSources(sourcesToDisplayByUrl, tabUrls, tabs.length > 0));
  }, []);
    const getDebounceMsHandler = useCallback(() => {
    const { sourceCount } = props;

    if (sourceCount > 10_000) {
      return 1000;
    }

    if (sourceCount > 1_000) {
      return 100;
    }

    return 50;
  }, []);
    const getUpdateResultsCallbackHandler = useCallback(() =>
    debounce(query => {
      if (isGotoQueryHandler()) {
        setResultsHandler([]);
      } else if (query == "" && !isShortcutQueryHandler()) {
        showTopSourcesHandler();
      } else if (isFunctionQueryHandler()) {
        searchFunctionsHandler(query);
      } else if (isShortcutQueryHandler()) {
        searchShortcutsHandler(query);
      } else {
        searchSourcesHandler(query);
      }
    }, getDebounceMsHandler()), []);
    const updateResults = useRef(getUpdateResultsCallbackHandler());
    const setModifierHandler = useCallback((item: SearchResultWithHighlighting) => {
    if (["@", "#", ":"].includes(item.id)) {
      props.setQuickOpenQuery(item.id);
    }
  }, []);
    const selectResultItemHandler = useCallback((e: any, item: SearchResultWithHighlighting) => {
    if (item == null) {
      return;
    }

    if (isShortcutQueryHandler()) {
      return setModifierHandler(item);
    }

    if (isGotoSourceQueryHandler()) {
      trackEvent("quick_open.select_line");

      const location = parseLineColumn(props.query);
      return gotoLocationHandler({ ...location, sourceId: item.id });
    }

    if (isFunctionQueryHandler()) {
      const start = item.location?.begin;
      trackEvent("quick_open.select_function");

      return gotoLocationHandler({
        line: start?.line || 0,
        sourceId: start?.sourceId,
      });
    }

    trackEvent("quick_open.select_source");
    gotoLocationHandler({ sourceId: item.id, line: 0 });
  }, []);
    const onSelectResultItemHandler = useCallback((item: SearchResult) => {
    const { selectedSource, highlightLineRange, project } = props;

    if (selectedSource == null || !isFunctionQueryHandler()) {
      return;
    }

    if (isFunctionQueryHandler() && !project) {
      return highlightLineRange({
        ...(item.location != null
          ? { end: item.location.end!.line, start: item.location.begin.line }
          : {}),
        sourceId: selectedSource.id,
      });
    }
  }, []);
    const traverseResultsHandler = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const direction = e.key === "ArrowUp" ? -1 : 1;
    
    const resultCount = getResultCountHandler();
    const index = selectedIndex + direction;
    const nextIndex = (index + resultCount) % resultCount || 0;

    setSelectedIndex(nextIndex);

    if (results != null) {
      onSelectResultItemHandler(results[nextIndex]);
    }
  }, [selectedIndex, results]);
    const gotoLocationHandler = useCallback((location?: { column?: number; line?: number; sourceId?: string }) => {
    const { cx, selectLocation, selectedSource, viewMode, setViewMode } = props;

    if (location != null) {
      const selectedSourceId = selectedSource ? selectedSource.id : "";
      const sourceId = location.sourceId ? location.sourceId : selectedSourceId;
      selectLocation(cx, {
        column: location.column,
        line: location.line,
        sourceId,
      });

      if (viewMode === "non-dev") {
        setViewMode("dev");
      }
      closeModalHandler();
    }
  }, []);
    const onChangeHandler = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { selectedSource, setQuickOpenQuery } = props;
    setQuickOpenQuery(e.target.value);

    let selectedContentLoaded = false;
    if (selectedSource) {
      const streaming = streamingSourceContentsCache.stream(replayClient, selectedSource.id);
      selectedContentLoaded = streaming?.complete === true;
    }
    const noSource = !selectedSource || !selectedContentLoaded;

    if ((noSource && isFunctionQueryHandler()) || isGotoQueryHandler()) {
      return;
    }

    updateResults.current(e.target.value);
  }, []);
    const onKeyDownHandler = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { enabled, query } = props;
    
    const isGoToQuery = isGotoQueryHandler();
    const results = results;

    if ((!enabled || !results) && !isGoToQuery) {
      return;
    }

    if (e.key === "Enter") {
      if (isGoToQuery) {
        const location = parseLineColumn(query);
        return gotoLocationHandler(location);
      }

      if (results) {
        return selectResultItemHandler(e, results[selectedIndex]);
      }
    }

    if (e.key === "Tab") {
      return closeModalHandler();
    }

    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      return traverseResultsHandler(e);
    }
  }, [results, selectedIndex]);
    const getResultCountHandler = useCallback(() => {
    const results = results;

    return results && results.length ? results.length : 0;
  }, [results]);
    const isFunctionQueryHandler = useCallback(() => props.searchType === "functions", []);
    const isGotoQueryHandler = useCallback(() => props.searchType === "goto", []);
    const isGotoSourceQueryHandler = useCallback(() => props.searchType === "gotoSource", []);
    const isShortcutQueryHandler = useCallback(() => props.searchType === "shortcuts", []);
    const isSourcesQueryHandler = useCallback(() => props.searchType === "sources", []);
    const isSourceSearchHandler = useCallback(() => isSourcesQueryHandler() || isGotoSourceQueryHandler(), []);
    const renderHighlightHandler = useCallback((candidateString: string, query: string) => {
    const options = {
      wrap: {
        tagClose: "</mark>",
        tagOpen: '<mark class="highlight">',
      },
    };

    // There might be a match in the path but not the title.
    // In this case just render the whole title, un-styled.
    //
    // Note that "fuzzaldrin-plus" returns an HTML string usually,
    // but if either the input string or the query string are empty, it returns an array.
    const html = query ? fuzzyAldrin.wrap(candidateString, query, options) : candidateString;

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }, []);
    const highlightMatchingHandler = useCallback((query: string, results: SearchResult[]): SearchResultWithHighlighting[] => {
    let newQuery = query;
    if (newQuery === "") {
      return results;
    }
    newQuery = query.replace(/[@:#?]/gi, " ");

    return results.map(result => {
      if (typeof result.title == "string") {
        return {
          ...result,
          title: renderHighlightHandler(result.title, basename(newQuery)),
        };
      }
      return result;
    });
  }, [results]);
    const shouldShowErrorEmojiHandler = useCallback(() => {
    const { query } = props;
    if (isGotoQueryHandler()) {
      return !/^:\d*:*\d*$/.test(query);
    }
    return !!query && !getResultCountHandler();
  }, []);
    const getSummaryMessageHandler = useCallback(() => {
    const { symbolsLoading, project, globalFunctionsLoading, query } = props;

    if (isGotoQueryHandler()) {
      const isValid = /^:\d*:*\d*$/.test(query);

      const [_, line, column] = query.split(":");
      if (!isValid || line == null || line == "") {
        return "Type a line number to navigate to";
      } else if (column != null && column !== "") {
        return `Go to line ${line} and column ${column}`;
      } else {
        return `Go to line ${line}`;
      }
    }

    if (project && globalFunctionsLoading) {
      return `Loading functions`;
    }

    if (isFunctionQueryHandler() && symbolsLoading) {
      return "Loading\u2026";
    }

    return "";
  }, []);

    const { enabled, query, sourcesLoading } = props;
    

    if (!enabled) {
      return null;
    }

    const items = highlightMatchingHandler(query, results || []);
    const expanded = !!items && items.length > 0;
    const showLoadingResults = query?.replace(/@/g, "") && results === null;

    return (
      <Modal
        width="500px"
        additionalClass={"rounded-lg text-xs"}
        in={enabled}
        handleClose={closeModalHandler}
      >
        <SearchInput
          query={query}
          hasPrefix={true}
          count={getResultCountHandler()}
          dataTestId="QuickOpenInput"
          placeholder={"Go to file…"}
          summaryMsg={getSummaryMessageHandler()}
          showErrorEmoji={shouldShowErrorEmojiHandler()}
          isLoading={false}
          onChange={onChangeHandler}
          onKeyDown={onKeyDownHandler}
          handleClose={closeModalHandler}
          expanded={expanded}
          showClose={false}
          selectedItemId={expanded && items[selectedIndex] ? items[selectedIndex].id : ""}
          size="big"
        />
        {sourcesLoading && <div className="px-2 py-1">Sources Loading…</div>}
        {!sourcesLoading && showLoadingResults && <div className="px-2 py-1">Loading results…</div>}
        {results && items && (
          <ResultList
            key="results"
            dataTestId="QuickOpenResultsList"
            items={items}
            selected={selectedIndex}
            selectItem={selectResultItemHandler}
            ref={resultList.current}
            expanded={expanded}
            {...(isSourceSearchHandler() ? SIZE_BIG : SIZE_DEFAULT)}
          />
        )}
      </Modal>
    ); 
};




interface QuickOpenModalProps {
  cx: Context;
  enabled: boolean;
  globalFunctions: SearchResult[];
  globalFunctionsLoading: boolean;
  project: boolean;
  query: string;
  searchType: SearchTypes;
  selectedSource: SourceDetails | null | undefined;
  showOnlyOpenSources: boolean;
  sourceCount: number;
  sourcesForTabs: SourceDetails[];
  sourcesLoading: boolean;
  sourcesToDisplayByUrl: ReturnType<typeof getSourcesToDisplayByUrl>;
  symbols: ReturnType<typeof formatSymbols>;
  symbolsLoading: boolean;
  tabs: Tab[];
  viewMode: ViewMode;
  closeQuickOpen: () => unknown;
  highlightLineRange: (range: HighlightedRange) => unknown;
  selectLocation: (cx: Context, location: PartialLocation, openSource?: boolean) => unknown;
  setQuickOpenQuery: (query: string) => unknown;
  setViewMode: (viewMode: ViewMode) => unknown;
}

export default function QuickOpenModalWrapper() {
  const sourceList = useAppSelector(getAllSourceDetails);
  const selectedSource = useAppSelector(getSelectedSource);
  const symbolsCacheValue = useImperativeCacheValue(
    sourceOutlineCache,
    replayClient,
    selectedSource?.id
  );
  const dispatch = useAppDispatch();
  const props: QuickOpenModalProps = {
    cx: useAppSelector(getContext),
    enabled: useAppSelector(getQuickOpenEnabled),
    globalFunctions: useAppSelector(getGlobalFunctions) || [],
    globalFunctionsLoading: useAppSelector(isGlobalFunctionsLoading),
    project: useAppSelector(getQuickOpenProject),
    query: useAppSelector(getQuickOpenQuery),
    searchType: useAppSelector(getQuickOpenType),
    selectedSource,
    showOnlyOpenSources: useAppSelector(getShowOnlyOpenSources),
    sourceCount: sourceList.length,
    sourcesForTabs: useAppSelector(getSourcesForTabs),
    sourcesLoading: useAppSelector(getSourcesLoading),
    sourcesToDisplayByUrl: useAppSelector(getSourcesToDisplayByUrl),
    symbols:
      symbolsCacheValue.status === "resolved"
        ? formatSymbols(symbolsCacheValue.value)
        : { functions: [] },
    symbolsLoading: symbolsCacheValue.status !== "resolved",
    tabs: useAppSelector(getTabs),
    viewMode: useAppSelector(getViewMode),
    closeQuickOpen: () => dispatch(actions.closeQuickOpen()),
    highlightLineRange: (range: HighlightedRange) => dispatch(actions.highlightLineRange(range)),
    selectLocation: (cx: Context, location: PartialLocation, openSource?: boolean) =>
      dispatch(actions.selectLocation(cx, location, openSource)),
    setQuickOpenQuery: (query: string) => dispatch(actions.setQuickOpenQuery(query)),
    setViewMode: (viewMode: ViewMode) => dispatch(setViewModeAction(viewMode)),
  };

  return <QuickOpenModal {...props} />;
}
