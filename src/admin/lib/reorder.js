/**
 * Returns a new array with the item at `fromIndex` moved to `toIndex`.
 * Never mutates `list`. Out-of-range indexes are a no-op (returns the
 * original array reference) rather than throwing, since OrderedList already
 * disables the buttons that would produce one.
 */
export function reorder(list, fromIndex, toIndex) {
  if (
    fromIndex === toIndex
    || fromIndex < 0 || toIndex < 0
    || fromIndex >= list.length || toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
