// A short list you reorder by dragging each row's grip handle. The other rows slide out of the
// way while you drag; the new order is reported once you let go. (Fixed row height.)
import React, { useEffect } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  rowHeight: number;
  /** Renders a row; put `handle` (the grip) where it should go. */
  renderRow: (item: T, handle: React.ReactNode, dragging: boolean) => React.ReactNode;
  renderHandle: () => React.ReactNode;
  onReorder: (keys: string[]) => void;
  onDragChange?: (dragging: boolean) => void;
};

export function DragList<T>({ items, keyOf, rowHeight, renderRow, renderHandle, onReorder, onDragChange }: Props<T>) {
  const keys = items.map(keyOf);
  const positions = useSharedValue<Record<string, number>>(Object.fromEntries(keys.map((k, i) => [k, i])));
  const sig = keys.join("\n");
  useEffect(() => {
    positions.value = Object.fromEntries(keys.map((k, i) => [k, i]));
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    const next = Object.entries(positions.value)
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    if (next.join("\n") !== sig) onReorder(next);
  };

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item, i) => (
        <Row
          key={keyOf(item)}
          id={keyOf(item)}
          index={i}
          count={items.length}
          rowHeight={rowHeight}
          positions={positions}
          onDrop={finish}
          onDragChange={onDragChange}
          handle={renderHandle()}
          render={(handle, dragging) => renderRow(item, handle, dragging)}
        />
      ))}
    </View>
  );
}

function Row({
  id,
  index,
  count,
  rowHeight,
  positions,
  onDrop,
  onDragChange,
  handle,
  render,
}: {
  id: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Record<string, number>>;
  onDrop: () => void;
  onDragChange?: (d: boolean) => void;
  handle: React.ReactNode;
  render: (handle: React.ReactNode, dragging: boolean) => React.ReactNode;
}) {
  const y = useSharedValue(index * rowHeight);
  const start = useSharedValue(0);
  const active = useSharedValue(false);
  const [dragging, setDragging] = React.useState(false);

  // Other rows glide to their new slot as the dragged one passes them.
  useAnimatedReaction(
    () => positions.value[id],
    (p) => {
      if (!active.value && p !== undefined) y.value = withTiming(p * rowHeight, { duration: 160 });
    },
  );

  const changed = (d: boolean) => {
    setDragging(d);
    onDragChange?.(d);
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      active.value = true;
      start.value = y.value;
      runOnJS(changed)(true);
    })
    .onUpdate((e) => {
      y.value = Math.max(0, Math.min((count - 1) * rowHeight, start.value + e.translationY));
      const to = Math.max(0, Math.min(count - 1, Math.round(y.value / rowHeight)));
      const from = positions.value[id];
      if (to === from) return;
      const next: Record<string, number> = { ...positions.value };
      for (const k of Object.keys(next)) {
        if (k === id) continue;
        const p = next[k];
        if (from < to && p > from && p <= to) next[k] = p - 1;
        else if (from > to && p >= to && p < from) next[k] = p + 1;
      }
      next[id] = to;
      positions.value = next;
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      y.value = withSpring(positions.value[id] * rowHeight, { damping: 22, stiffness: 260 });
      runOnJS(changed)(false);
      runOnJS(onDrop)();
    });

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    height: rowHeight,
    transform: [{ translateY: y.value }, { scale: active.value ? 1.02 : 1 }],
    zIndex: active.value ? 10 : 0,
    shadowOpacity: active.value ? 0.18 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: active.value ? 6 : 0,
  }));

  return (
    <Animated.View style={style}>
      {render(
        <GestureDetector gesture={pan}>
          <View>{handle}</View>
        </GestureDetector>,
        dragging,
      )}
    </Animated.View>
  );
}
