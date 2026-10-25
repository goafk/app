// A TextInput that continues Markdown lists as you type and keeps numbered ones in order (see lib/lists).
// A toolbar can drive it through `editor`: indent, checklist, code… applied at the current selection.
import React, { forwardRef, useRef, useState } from "react";
import { Platform, TextInput } from "react-native";
import type { TextInputProps } from "react-native";
import { continueList, renumberAfterDelete } from "../lib/lists";
import type { Edit } from "../lib/lists";

export type MarkdownEditor = { apply: (fn: (text: string, start: number, end: number) => Edit) => void };

// Does the selection event for a keystroke arrive before its change event? iOS sends the change first
// (RCTTextInputComponentView guarantees it); elsewhere we learn it from ordinary typing.
let selectionFirst: boolean | undefined = Platform.OS === "ios" ? false : undefined;

/** Where the caret was before this edit, from the last selection event (null when unknown). */
function caretBefore(prev: string, next: string, sel: { start: number; end: number } | null): number | undefined {
  if (!sel || sel.start !== sel.end || next.length !== prev.length + 1) return undefined;
  let k = 0;
  while (k < prev.length && prev[k] === next[k]) k++;
  // A character typed next to a copy of itself (Enter after Enter) could have gone either side; otherwise k is exact.
  if (k === 0 || next[k - 1] !== next[k]) {
    if (sel.start === k) selectionFirst = false;
    else if (sel.start === k + 1) selectionFirst = true;
  }
  if (selectionFirst === undefined) return undefined;
  return selectionFirst ? sel.start - 1 : sel.start;
}

type Props = TextInputProps & { editor?: React.MutableRefObject<MarkdownEditor | null> };

export const MarkdownInput = forwardRef<TextInput, Props>(function MarkdownInput({ value, onChangeText, onSelectionChange, editor, ...rest }, ref) {
  // After we edit the text, place the selection once, then hand it back to the user.
  const [placed, setPlaced] = useState<{ start: number; end: number } | null>(null);
  const last = useRef(value ?? "");
  last.current = value ?? "";
  const sel = useRef<{ start: number; end: number } | null>(null);
  if (editor)
    editor.current = {
      apply: (fn) => {
        const text = last.current;
        const at = sel.current ?? { start: text.length, end: text.length };
        const r = fn(text, Math.min(at.start, text.length), Math.min(at.end, text.length));
        if (r.text === text && r.start === at.start && r.end === at.end) return;
        sel.current = { start: r.start, end: r.end };
        setPlaced({ start: r.start, end: r.end });
        onChangeText?.(r.text);
      },
    };

  return (
    <TextInput
      ref={ref}
      {...rest}
      value={value}
      selection={placed ?? undefined}
      onSelectionChange={(e) => {
        sel.current = e.nativeEvent.selection;
        if (placed !== null) setPlaced(null);
        onSelectionChange?.(e);
      }}
      onChangeText={(v) => {
        const c = rest.multiline ? (continueList(last.current, v, caretBefore(last.current, v, sel.current)) ?? renumberAfterDelete(last.current, v)) : null;
        setPlaced(c ? { start: c.caret, end: c.caret } : null);
        onChangeText?.(c ? c.text : v);
      }}
    />
  );
});
