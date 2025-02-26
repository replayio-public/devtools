import { ObjectId, PauseId } from "@replayio/protocol";
import {
  ChangeEvent,
  KeyboardEvent,
  RefObject,
  Suspense,
  useContext,
  useRef,
  useState,
} from "react";
import AutoSizer from "react-virtualized-auto-sizer";

import { ElementsList, ImperativeHandle } from "replay-next/components/elements/ElementsList";
import { ElementsPanelLoader } from "replay-next/components/elements/ElementsPanelLoader";
import { domSearchCache } from "replay-next/components/elements/suspense/DOMSearchCache";
import Icon from "replay-next/components/Icon";
import { ReplayClientContext } from "shared/client/ReplayClientContext";

import styles from "./ElementsPanel.module.css";

export function ElementsPanel({
  listRef,
  onSelectionChange,
  pauseId,
}: {
  listRef: RefObject<ImperativeHandle>;
  onSelectionChange?: (id: ObjectId | null) => void;
  pauseId: PauseId | null;
}) {
  const replayClient = useContext(ReplayClientContext);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchInProgress, setSearchInProgress] = useState(false);
  const [searchState, setSearchState] = useState<{
    index: number;
    query: string;
    results: ObjectId[];
  } | null>(null);
  const [query, setQuery] = useState("");

  const onListKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "F":
      case "f": {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();

          const input = searchInputRef.current;
          if (input) {
            input.focus();
          }
        }
        break;
      }
    }
  };

  const onSearchInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  };

  const onSearchInputKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (pauseId == null) {
      return;
    }

    if (document.querySelector('[data-test-id="ElementsList"]') === null) {
      return;
    }

    switch (event.key) {
      case "Enter": {
        event.preventDefault();
        event.stopPropagation();

        if (query === "") {
          setSearchState(null);
        } else if (searchState?.query === query) {
          let index = searchState.index;
          if (event.shiftKey) {
            index = index > 0 ? index - 1 : searchState.results.length - 1;
          } else {
            index = index < searchState.results.length - 1 ? searchState.index + 1 : 0;
          }

          setSearchState({
            ...searchState,
            index,
          });

          const list = listRef.current;
          if (list) {
            const id = searchState.results[index];
            list.selectNode(id);
          }
        } else {
          setSearchInProgress(true);
          const results = await domSearchCache.readAsync(replayClient, pauseId, query);
          setSearchInProgress(false);
          setSearchState({
            index: results.length > 0 ? 0 : -1,
            query,
            results,
          });

          if (results.length > 0) {
            const list = listRef.current;
            if (list) {
              const id = results[0];
              list.selectNode(id);
            }
          }
        }
        break;
      }
      case "Escape": {
        setQuery("");
        setSearchState(null);
        break;
      }
    }
  };

  return (
    <div className={styles.Panel}>
      <div className={styles.SearchRow}>
        <label className={styles.SearchIconAndInput}>
          <Icon className={styles.SearchIcon} type="search" />
          <input
            className={styles.SearchInput}
            data-search-in-progress={searchInProgress || undefined}
            data-test-id="ElementsSearchInput"
            disabled={pauseId == null}
            onChange={onSearchInputChange}
            onKeyDown={onSearchInputKeyDown}
            placeholder="Search DOM"
            ref={searchInputRef}
            type="text"
            value={query}
          />
        </label>
        {searchState !== null && (
          <div className={styles.SearchResults} data-test-id="ElementsPanel-SearchResult">
            {searchState.index + 1} of {searchState.results.length}
          </div>
        )}
      </div>
      <div className={styles.ListRow} onKeyDown={onListKeyDown}>
        {pauseId ? (
          <AutoSizer disableWidth>
            {({ height }: { height: number }) => (
              <Suspense fallback={<ElementsPanelLoader />}>
                <ElementsList
                  height={height}
                  forwardedRef={listRef}
                  key={pauseId}
                  noContentFallback={<ElementsPanelLoader />}
                  onSelectionChange={onSelectionChange}
                  pauseId={pauseId}
                />
              </Suspense>
            )}
          </AutoSizer>
        ) : (
          <ElementsPanelLoader />
        )}
      </div>
    </div>
  );
}
