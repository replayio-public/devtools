import { PauseId } from "@replayio/protocol";
import { FrontendBridge } from "@replayio/react-devtools-inline";
import { CSSProperties, useEffect } from "react";

import { GenericList } from "replay-next/components/windowing/GenericList";
import { useDynamicIndentationListCSSVariables } from "replay-next/components/windowing/hooks/useDynamicIndentationListCSSVariables";
import {
  ITEM_SIZE,
  ItemData,
  ReactDevToolsListItem,
} from "ui/components/SecondaryToolbox/react-devtools/components/ReactDevToolsListItem";
import { useHighlightNativeElement } from "ui/components/SecondaryToolbox/react-devtools/hooks/useHighlightNativeElement";
import { ReactDevToolsListData } from "ui/components/SecondaryToolbox/react-devtools/ReactDevToolsListData";
import {
  ReplayWall,
  StoreWithInternals,
} from "ui/components/SecondaryToolbox/react-devtools/ReplayWall";
import { ReactElement } from "ui/components/SecondaryToolbox/react-devtools/types";

import styles from "./ReactDevToolsList.module.css";

export function ReactDevToolsList({
  bridge,
  height,
  listData,
  pauseId,
  store,
  wall,
  width,
}: {
  bridge: FrontendBridge;
  height: number;
  listData: ReactDevToolsListData;
  pauseId: PauseId;
  store: StoreWithInternals;
  wall: ReplayWall;
  width: number;
}) {
  const { cssVariables, onItemsRendered } = useDynamicIndentationListCSSVariables(
    "ReactDevToolsList",
    width
  );

  const onMouseMove = useHighlightNativeElement(store, wall, listData);

  useEffect(() => {
    const onSelectFiber = (id: number) => {
      const item = listData.getItemById(id);
      if (item) {
        const index = listData.getIndexForItem(item);
        if (index >= 0) {
          listData.setSelectedIndex(index);
        }
      }
    };

    bridge.addListener("selectFiber", onSelectFiber);

    return () => {
      bridge.removeListener("selectFiber", onSelectFiber);
    };
  }, [bridge, listData]);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = listData.getSelectedIndex();
    if (index == null) {
      return;
    }

    const element = listData.getItemAtIndex(index);
    switch (event.key) {
      case "ArrowLeft": {
        event.preventDefault();
        event.stopPropagation();

        const hasChildren = element.children.length > 0;
        if (hasChildren && !element.isCollapsed) {
          listData.toggleCollapsed(element);
        } else {
          const parentElement = listData.getItemById(element.parentID);
          if (parentElement) {
            const parentIndex = listData.getIndexForItem(parentElement);
            listData.setSelectedIndex(parentIndex);
          }
        }
        break;
      }
      case "ArrowRight": {
        event.preventDefault();
        event.stopPropagation();

        const hasChildren = element.children.length > 0;
        if (hasChildren) {
          if (element.isCollapsed) {
            listData.toggleCollapsed(element);
          } else {
            listData.setSelectedIndex(index + 1);
          }
        }
        break;
      }
    }
  };

  return (
    <GenericList<ReactElement, ItemData>
      className={styles.List}
      dataTestId="ReactDevToolsList"
      height={height}
      itemData={{
        store,
      }}
      itemRendererComponent={ReactDevToolsListItem}
      itemSize={ITEM_SIZE}
      listData={listData}
      onItemsRendered={onItemsRendered}
      onKeyDown={onKeyDown}
      onMouseMove={onMouseMove}
      style={cssVariables as CSSProperties}
      width={width}
    />
  );
}
