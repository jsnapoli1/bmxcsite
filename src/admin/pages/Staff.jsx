import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent } from '../lib/api.js';
import { reorder } from '../lib/reorder.js';
import { contentMatchesPublished } from '../lib/content-diff.js';
import OrderedList from '../components/OrderedList.jsx';

const EMPTY_MEMBER = { name: '', role: '', bio: '', since: '' };

export default function Staff() {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(() => new Set());

  function markPending(key) {
    setPending((prev) => new Set(prev).add(key));
  }

  function clearPending(key) {
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function refresh() {
    const data = await getContent('staff');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const hasUnpublishedChanges = draft && published && !contentMatchesPublished('staff', draft, published);

  function updateGroups(nextGroups) {
    setDraft({ ...draft, groups: nextGroups });
  }

  function updateGroup(groupIndex, changes) {
    updateGroups(draft.groups.map(
      (group, i) => (i === groupIndex ? { ...group, ...changes } : group),
    ));
  }

  function addGroup() {
    updateGroups([...draft.groups, { group: 'New group', members: [] }]);
  }

  function removeGroup(groupIndex) {
    const group = draft.groups[groupIndex];
    const memberCount = group.members?.length ?? 0;
    const warning = memberCount > 0
      ? `Delete "${group.group}" and its ${memberCount} member${memberCount === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete "${group.group}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    updateGroups(draft.groups.filter((_, i) => i !== groupIndex));
  }

  function reorderGroups(fromIndex, toIndex) {
    updateGroups(reorder(draft.groups, fromIndex, toIndex));
  }

  function addMember(groupIndex) {
    const group = draft.groups[groupIndex];
    updateGroup(groupIndex, { members: [...(group.members ?? []), { ...EMPTY_MEMBER }] });
  }

  function updateMember(groupIndex, memberIndex, changes) {
    const group = draft.groups[groupIndex];
    const members = group.members.map(
      (member, i) => (i === memberIndex ? { ...member, ...changes } : member),
    );
    updateGroup(groupIndex, { members });
  }

  function removeMember(groupIndex, memberIndex) {
    const group = draft.groups[groupIndex];
    const member = group.members[memberIndex];
    if (!window.confirm(`Remove ${member.name || 'this person'} from ${group.group}?`)) return;
    updateGroup(groupIndex, { members: group.members.filter((_, i) => i !== memberIndex) });
  }

  function reorderMembers(groupIndex, fromIndex, toIndex) {
    const group = draft.groups[groupIndex];
    updateGroup(groupIndex, { members: reorder(group.members, fromIndex, toIndex) });
  }

  async function handleSave() {
    const key = 'save';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await saveContent('staff', draft);
      await refresh();
      setStatus('Saved as a draft. The public site has not changed yet.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handlePublish() {
    const key = 'publish';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await publishContent('staff');
      await refresh();
      setStatus('Published. The public site now shows this.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  if (!draft) {
    return (
      <section className="admin-section" aria-labelledby="staff-heading">
        <h2 id="staff-heading">Staff</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  return (
    <section className="admin-section" aria-labelledby="staff-heading">
      <h2 id="staff-heading">Staff</h2>
      <p className="admin-help">
        Groups appear in this order on the staff page, and members appear in
        this order within each group.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {status && <p className="admin-status" role="status">{status}</p>}

      <p className="admin-draft-state">
        {hasUnpublishedChanges
          ? 'This has unsaved or unpublished changes. The public site still shows the last published version.'
          : 'The public site matches what is shown here.'}
      </p>

      <div className="admin-actions">
        <button
          type="button"
          className="admin-save"
          disabled={pending.has('save')}
          aria-busy={pending.has('save')}
          onClick={handleSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="admin-publish"
          disabled={pending.has('publish')}
          aria-busy={pending.has('publish')}
          onClick={handlePublish}
        >
          Publish
        </button>
      </div>

      <OrderedList
        items={draft.groups}
        // Positional key: the payload has no stable per-group id (see
        // repository.js's saveStaffStatements — groups are keyed by array
        // position on write, not a persisted identifier), so there is
        // nothing more stable to key on today. Fine while list items have
        // no internal focus or transition state; revisit if either is
        // added, since a reorder would then reattach the wrong item's
        // state to the wrong row.
        getKey={(group, i) => `group-${i}`}
        onReorder={reorderGroups}
        renderItem={(group, groupIndex) => (
          <div className="staff-group">
            <div className="staff-group__header">
              <label className="admin-field">
                Group name
                <input
                  type="text"
                  value={group.group}
                  onChange={(e) => updateGroup(groupIndex, { group: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="admin-remove"
                onClick={() => removeGroup(groupIndex)}
              >
                Delete group
              </button>
            </div>

            <OrderedList
              items={group.members ?? []}
              // Same reasoning as the group-level getKey above: no stable
              // per-member id exists in this payload shape.
              getKey={(member, i) => `member-${i}`}
              onReorder={(from, to) => reorderMembers(groupIndex, from, to)}
              renderItem={(member, memberIndex) => (
                <div className="staff-member">
                  <label className="admin-field">
                    Name
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(groupIndex, memberIndex, { name: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    Role
                    <input
                      type="text"
                      value={member.role ?? ''}
                      onChange={(e) => updateMember(groupIndex, memberIndex, { role: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    Since
                    <input
                      type="text"
                      value={member.since ?? ''}
                      onChange={(e) => updateMember(groupIndex, memberIndex, { since: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-field--wide">
                    Bio
                    <textarea
                      value={member.bio ?? ''}
                      onChange={(e) => updateMember(groupIndex, memberIndex, { bio: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => removeMember(groupIndex, memberIndex)}
                  >
                    Remove
                  </button>
                </div>
              )}
            />
            <button type="button" className="admin-add" onClick={() => addMember(groupIndex)}>
              Add a person to {group.group}
            </button>
          </div>
        )}
      />

      <button type="button" className="admin-add" onClick={addGroup}>
        Add a group
      </button>
    </section>
  );
}
