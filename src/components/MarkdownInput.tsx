// A TextInput that continues Markdown lists as you type and keeps numbered ones in order (see lib/lists).
import React, { forwardRef, useRef, useState } from "react";
import { Platform, TextInput } from "react-native";
import type { TextInputProps } from "react-native";
import { continueList, renumberAfterDelete } from "../lib/lists";

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

export const MarkdownInput = forwardRef<TextInput, TextInputProps>(function MarkdownInput({ value, onChangeText, onSelectionChange, ...rest }, ref) {
  // After we insert a marker, place the caret after it once, then hand the selection back to the user.
  const [caret, setCaret] = useState<number | null>(null);
  const last = useRef(value ?? "");
  last.current = value ?? "";
  const sel = useRef<{ start: number; end: number } | null>(null);

  return (
    <TextInput
      ref={ref}
      {...rest}
      value={value}
      selection={caret === null ? undefined : { start: caret, end: caret }}
      onSelectionChange={(e) => {
        sel.current = e.nativeEvent.selection;
        if (caret !== null) setCaret(null);
        onSelectionChange?.(e);
      }}
      onChangeText={(v) => {
        const c = rest.multiline ? (continueList(last.current, v, caretBefore(last.current, v, sel.current)) ?? renumberAfterDelete(last.current, v)) : null;
        setCaret(c ? c.caret : null);
        onChangeText?.(c ? c.text : v);
      }}
    />
  );
});
