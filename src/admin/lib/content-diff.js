/**
 * Compares a draft against the published content for the same area,
 * answering "does the public site already match this draft?" for the
 * admin UI's unpublished-changes banner.
 *
 * The repository's `getPublished` (worker/content/repository.js) omits any
 * parent (a staff group, an FAQ category) whose children are all still
 * drafts — see the nested-status policy comment there. That is a *display*
 * decision for the public site. But `getAll`'s draft shape has no such
 * filter: it always shows every parent, including ones with zero published
 * (or zero total) children, because editors need to see the true state.
 *
 * Comparing those two shapes directly with JSON.stringify means a group
 * with no members can never match its own published omission — the banner
 * reads "unpublished changes" forever, even immediately after a successful
 * publish. This helper applies the same omission to the draft side before
 * comparing, so both sides are judged by the same rule and the comparison
 * reflects what the public site actually does, not an artifact of two
 * different filtering policies.
 */

/** Areas whose payload has a parent/child pair subject to the nested-status
 * policy, keyed to the field names on each payload shape. */
const NESTED_AREAS = {
  staff: { parents: 'groups', children: 'members' },
  faq: { parents: 'categories', children: 'items' },
};

/**
 * Returns a copy of `content` with the same empty-parent omission
 * `getPublished` applies: any parent whose children array is empty (or
 * missing) is dropped. Areas without a nested parent/child shape (merch,
 * campinfo) are returned unchanged — they have nothing to filter.
 */
function applyNestedStatusFilter(area, content) {
  const nested = NESTED_AREAS[area];
  if (!nested || !content) return content;

  const parents = content[nested.parents] ?? [];
  return {
    ...content,
    [nested.parents]: parents.filter(
      (parent) => (parent[nested.children] ?? []).length > 0,
    ),
  };
}

/**
 * True when `draft` and `published` represent the same content once the
 * nested-status policy is applied to both — i.e. the public site already
 * shows this draft, nothing left to publish.
 */
export function contentMatchesPublished(area, draft, published) {
  if (!draft || !published) return false;
  const normalizedDraft = applyNestedStatusFilter(area, draft);
  return JSON.stringify(normalizedDraft) === JSON.stringify(published);
}
