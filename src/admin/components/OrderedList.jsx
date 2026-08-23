/**
 * Renders a list with up/down reorder controls instead of drag-and-drop.
 * Drag needs a dependency, breaks on touch, and is invisible to screen
 * readers; up/down buttons work everywhere and these lists are short.
 *
 * `items` must be plain objects; `getKey` extracts a stable React key.
 * `renderItem(item, index)` renders the row body. `onReorder(from, to)` is
 * called with the two indexes to swap. Up is disabled on the first item,
 * Down on the last.
 */
export default function OrderedList({
  items, getKey, renderItem, onReorder, disabled = false,
}) {
  return (
    <ol className="ordered-list">
      {items.map((item, index) => {
        const key = getKey(item, index);
        return (
          <li className="ordered-list__row" key={key}>
            <div className="ordered-list__controls">
              <button
                type="button"
                className="ordered-list__move"
                disabled={disabled || index === 0}
                aria-label="Move up"
                onClick={() => onReorder(index, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="ordered-list__move"
                disabled={disabled || index === items.length - 1}
                aria-label="Move down"
                onClick={() => onReorder(index, index + 1)}
              >
                ↓
              </button>
            </div>
            <div className="ordered-list__body">
              {renderItem(item, index)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
