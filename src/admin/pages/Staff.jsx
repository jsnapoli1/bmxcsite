import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent, listMedia } from '../lib/api.js';
import { reorder } from '../lib/reorder.js';
import { contentMatchesPublished } from '../lib/content-diff.js';
import { usePending } from '../lib/use-pending.js';
import OrderedList from '../components/OrderedList.jsx';
import { Busy, Failure } from '../components/States.jsx';

/**
 * The staff editor: a roster you can scan, and one person open at a time.
 *
 * This used to render every group expanded with every member's fields inline,
 * so adding one coach meant scrolling past all ten. The shape here is the one
 * Blog.jsx already uses — a list, and an editor panel for the row you picked.
 *
 * Members carry a `slug` now, so `OrderedList` keys on a real identifier
 * rather than array position. The old positional keys were flagged in a
 * comment as a bug waiting for a row to gain internal state; the photo picker
 * below is exactly that state.
 */

const EMPTY_MEMBER = {
  slug: '',
  name: '',
  role: '',
  since: '',
  education: '',
  hometown: '',
  bio: '',
  photo: null,
  accolades: [],
};

/** "Ken Crawford" -> "ken-crawford". Only ever used to mint a missing slug. */
function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(base, taken) {
  const root = base || 'member';
  let slug = root;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${root}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export default function Staff() {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [media, setMedia] = useState([]);
  // Which member is open, by slug. Null means the roster.
  const [editingSlug, setEditingSlug] = useState(null);
  const { isPending, run } = usePending();

  async function refresh() {
    const data = await getContent('staff');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
    // Only published photos can be used, for the reason Blog.jsx gives: a
    // private one 404s at /media/<key> for every visitor.
    listMedia()
      // The response is `{ media: [...] }`, not a bare array — filtering the
      // wrapper silently yields an empty picker with no error anywhere.
      //
      // Images only: the library holds video too, and a headshot slot that
      // offers an .mp4 invites a choice that renders as a broken <img>.
      .then(({ media: items }) => setMedia(items.filter(
        (item) => item.status === 'public' && item.content_type?.startsWith('image/'),
      )))
      .catch(() => setMedia([]));
  }, []);

  const hasUnpublishedChanges =
    draft && published && !contentMatchesPublished('staff', draft, published);

  const allMembers = (draft?.groups ?? []).flatMap((group, groupIndex) =>
    (group.members ?? []).map((member, memberIndex) => ({
      member, groupIndex, memberIndex, groupName: group.group,
    })),
  );
  const editing = allMembers.find((entry) => entry.member.slug === editingSlug) ?? null;

  function updateDraft(changes) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function updateGroups(nextGroups) {
    updateDraft({ groups: nextGroups });
  }

  function updateGroup(groupIndex, changes) {
    updateGroups(draft.groups.map((g, i) => (i === groupIndex ? { ...g, ...changes } : g)));
  }

  function updateMember(groupIndex, memberIndex, changes) {
    const group = draft.groups[groupIndex];
    updateGroup(groupIndex, {
      members: group.members.map((m, i) => (i === memberIndex ? { ...m, ...changes } : m)),
    });
  }

  function addMember(groupIndex) {
    const taken = new Set(allMembers.map((entry) => entry.member.slug).filter(Boolean));
    const slug = uniqueSlug('new-member', taken);
    const group = draft.groups[groupIndex];
    updateGroup(groupIndex, { members: [...(group.members ?? []), { ...EMPTY_MEMBER, slug }] });
    setEditingSlug(slug);
  }

  function removeMember(groupIndex, memberIndex) {
    const member = draft.groups[groupIndex].members[memberIndex];
    if (!window.confirm(`Remove ${member.name || 'this member'} from the staff page?`)) return;
    updateGroup(groupIndex, {
      members: draft.groups[groupIndex].members.filter((_, i) => i !== memberIndex),
    });
    if (member.slug === editingSlug) setEditingSlug(null);
  }

  function addGroup() {
    updateGroups([...draft.groups, { group: 'New group', members: [] }]);
  }

  function removeGroup(groupIndex) {
    const group = draft.groups[groupIndex];
    const count = group.members?.length ?? 0;
    const warning = count
      ? `Delete "${group.group}" and its ${count} member${count === 1 ? '' : 's'}?`
      : `Delete "${group.group}"?`;
    if (!window.confirm(warning)) return;
    updateGroups(draft.groups.filter((_, i) => i !== groupIndex));
    setEditingSlug(null);
  }

  function reorderMembers(groupIndex, from, to) {
    updateGroup(groupIndex, { members: reorder(draft.groups[groupIndex].members, from, to) });
  }

  function updateList(key, next) {
    updateDraft({ [key]: next });
  }

  async function handleSave() {
    setError(null);
    setStatus(null);
    await run('save', async () => {
      try {
        // A member with no slug cannot be addressed — mint one from the name
        // at save rather than on every keystroke, so a half-typed name does
        // not become the URL.
        const taken = new Set();
        const groups = draft.groups.map((group) => ({
          ...group,
          members: (group.members ?? []).map((member) => {
            const slug = uniqueSlug(member.slug || slugify(member.name), taken);
            taken.add(slug);
            return { ...member, slug };
          }),
        }));
        await saveContent('staff', { ...draft, groups });
        await refresh();
        setStatus('Saved as a draft. The public site has not changed yet.');
      } catch (err) {
        setError(err.message);
      }
    });
  }

  async function handlePublish() {
    setError(null);
    setStatus(null);
    await run('publish', async () => {
      try {
        await publishContent('staff');
        await refresh();
        setStatus('Published. The public site now shows this.');
      } catch (err) {
        setError(err.message);
      }
    });
  }

  if (error && !draft) return <Failure message={error} />;
  if (!draft) return <Busy label="Loading staff…" />;

  return (
    <section className="admin-section" aria-labelledby="staff-heading">
      <h2 id="staff-heading">Staff</h2>

      <Failure message={error} />
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
          disabled={isPending('save')}
          aria-busy={isPending('save')}
          onClick={handleSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="admin-publish"
          disabled={isPending('publish')}
          aria-busy={isPending('publish')}
          onClick={handlePublish}
        >
          Publish
        </button>
      </div>

      {editing ? (
        <MemberEditor
          entry={editing}
          media={media}
          onChange={(changes) => updateMember(editing.groupIndex, editing.memberIndex, changes)}
          onClose={() => setEditingSlug(null)}
          onRemove={() => removeMember(editing.groupIndex, editing.memberIndex)}
        />
      ) : (
        <Roster
          draft={draft}
          onEdit={setEditingSlug}
          onAddMember={addMember}
          onAddGroup={addGroup}
          onRemoveGroup={removeGroup}
          onRenameGroup={(i, name) => updateGroup(i, { group: name })}
          onReorderMembers={reorderMembers}
          onReorderGroups={(from, to) => updateGroups(reorder(draft.groups, from, to))}
        />
      )}

      {!editing && (
        <>
          <SimpleList
            heading="Guest speakers"
            help="Past speakers, newest first. Shown at the foot of the staff page."
            items={draft.speakers ?? []}
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'year', label: 'Year' },
              { name: 'credential', label: 'Credential', wide: true, multiline: true },
            ]}
            emptyItem={{ name: '', year: '', credential: '' }}
            onChange={(next) => updateList('speakers', next)}
          />
          <SimpleList
            heading="Staff credentials"
            help="What the staff collectively hold — nursing cover, lifeguard certification."
            items={draft.credentials ?? []}
            fields={[{ name: 'text', label: 'Credential', wide: true }]}
            emptyItem={{ text: '' }}
            onChange={(next) => updateList('credentials', next)}
          />
        </>
      )}
    </section>
  );
}

/** The roster: every member at a glance, grouped, each row opening an editor. */
function Roster({
  draft, onEdit, onAddMember, onAddGroup, onRemoveGroup, onRenameGroup,
  onReorderMembers, onReorderGroups,
}) {
  return (
    <>
      <p className="admin-help">
        Groups appear in this order on the staff page, and members in this
        order within each group. Select someone to edit their details.
      </p>

      <OrderedList
        items={draft.groups}
        getKey={(group, i) => group.id ?? `group-${i}`}
        onReorder={onReorderGroups}
        renderItem={(group, groupIndex) => (
          <div className="staff-group">
            <div className="staff-group__header">
              <label className="admin-field">
                Group name
                <input
                  type="text"
                  value={group.group}
                  onChange={(e) => onRenameGroup(groupIndex, e.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-remove"
                onClick={() => onRemoveGroup(groupIndex)}
              >
                Delete group
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Title</th>
                  <th scope="col">Photo</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(group.members ?? []).map((member, memberIndex) => (
                  <tr key={member.slug || `member-${memberIndex}`}>
                    <td data-label="Name">{member.name || '(unnamed)'}</td>
                    <td data-label="Title">{member.role || '—'}</td>
                    <td data-label="Photo">{member.photo?.key ? 'Yes' : '—'}</td>
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="admin-linklike"
                        onClick={() => onEdit(member.slug)}
                      >
                        Edit
                      </button>
                      {memberIndex > 0 && (
                        <button
                          type="button"
                          className="admin-linklike"
                          onClick={() => onReorderMembers(groupIndex, memberIndex, memberIndex - 1)}
                        >
                          Move up
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              className="admin-add"
              onClick={() => onAddMember(groupIndex)}
            >
              Add someone to {group.group}
            </button>
          </div>
        )}
      />

      <button type="button" className="admin-add" onClick={onAddGroup}>
        Add a group
      </button>
    </>
  );
}

/** One person, every field, nothing else on screen. */
function MemberEditor({ entry, media, onChange, onClose, onRemove }) {
  const { member, groupName } = entry;

  function updateAccolade(index, text) {
    onChange({
      accolades: member.accolades.map((a, i) => (i === index ? { ...a, text } : a)),
    });
  }

  function addAccolade() {
    onChange({
      accolades: [...(member.accolades ?? []), { id: `accolade-${Date.now()}`, text: '' }],
    });
  }

  return (
    <div className="staff-member-editor">
      <div className="staff-group__header">
        <h3 className="admin-subheading">
          {member.name || 'New member'} <span className="admin-help">in {groupName}</span>
        </h3>
        <button type="button" className="admin-linklike" onClick={onClose}>
          Back to the roster
        </button>
      </div>

      <div className="campinfo-fields">
        <label className="admin-field">
          Name
          <input type="text" value={member.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>

        <label className="admin-field">
          Title
          <input type="text" value={member.role ?? ''} onChange={(e) => onChange({ role: e.target.value })} />
          <span className="admin-field__hint">
            Put a speciality in the title itself, the way college programmes do
            — &ldquo;Veteran Coach (Distance)&rdquo;.
          </span>
        </label>

        <label className="admin-field">
          On staff since
          <input
            type="text"
            inputMode="numeric"
            value={member.since ?? ''}
            onChange={(e) => onChange({ since: e.target.value })}
          />
          <span className="admin-field__hint">
            A year. The page works out the wording — &ldquo;in their 20th
            summer&rdquo; — so it stays right next year without an edit.
          </span>
        </label>

        <label className="admin-field">
          Education
          <input
            type="text"
            value={member.education ?? ''}
            onChange={(e) => onChange({ education: e.target.value })}
          />
        </label>

        <label className="admin-field">
          Hometown
          <input
            type="text"
            value={member.hometown ?? ''}
            onChange={(e) => onChange({ hometown: e.target.value })}
          />
        </label>

        <label className="admin-field">
          Photo
          <select
            value={member.photo?.key ?? ''}
            onChange={(e) => onChange({
              photo: e.target.value
                ? { key: e.target.value, alt: member.photo?.alt ?? '' }
                : null,
            })}
          >
            <option value="">No photo</option>
            {media.map((item) => (
              <option key={item.key} value={item.key}>{item.filename}</option>
            ))}
          </select>
          <span className="admin-field__hint">
            Only published photos are offered. Publish it on the Photos &amp;
            videos page first, or it will not load for visitors.
          </span>
        </label>

        {member.photo?.key && (
          <label className="admin-field">
            Photo description
            <input
              type="text"
              value={member.photo.alt ?? ''}
              onChange={(e) => onChange({ photo: { ...member.photo, alt: e.target.value } })}
            />
            <span className="admin-field__hint">
              Read aloud in place of the photo. &ldquo;Ken Crawford&rdquo; is
              enough for a headshot.
            </span>
          </label>
        )}

        <label className="admin-field admin-field--wide">
          Bio
          <textarea value={member.bio ?? ''} onChange={(e) => onChange({ bio: e.target.value })} />
        </label>
      </div>

      <h4 className="admin-subheading">Accolades</h4>
      <p className="admin-help">
        One achievement per line, and lead with the number where there is one —
        &ldquo;29 cross country seasons at Morristown High School&rdquo;.
      </p>
      <OrderedList
        items={member.accolades ?? []}
        getKey={(accolade, i) => accolade.id ?? `accolade-${i}`}
        onReorder={(from, to) => onChange({ accolades: reorder(member.accolades, from, to) })}
        renderItem={(accolade, index) => (
          <div className="staff-member">
            <label className="admin-field admin-field--wide">
              <span className="sr-only">Accolade</span>
              <input
                type="text"
                value={accolade.text}
                onChange={(e) => updateAccolade(index, e.target.value)}
              />
            </label>
            <button
              type="button"
              className="admin-remove"
              onClick={() => onChange({
                accolades: member.accolades.filter((_, i) => i !== index),
              })}
            >
              Remove
            </button>
          </div>
        )}
      />
      <button type="button" className="admin-add" onClick={addAccolade}>
        Add an accolade
      </button>

      <div className="admin-actions">
        <button type="button" className="admin-remove" onClick={onRemove}>
          Remove {member.name || 'this member'} from the staff page
        </button>
      </div>
    </div>
  );
}

/**
 * A flat, ordered list of small records — guest speakers, staff credentials.
 *
 * Both were static until the roster redesign, so neither has ever had an
 * editor. They are simple enough not to need the master/detail treatment.
 */
function SimpleList({ heading, help, items, fields, emptyItem, onChange }) {
  function update(index, changes) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  }

  return (
    <>
      <h3 className="admin-subheading">{heading}</h3>
      <p className="admin-help">{help}</p>
      <OrderedList
        items={items}
        getKey={(item, i) => item.id ?? `item-${i}`}
        onReorder={(from, to) => onChange(reorder(items, from, to))}
        renderItem={(item, index) => (
          <div className="staff-member">
            {fields.map((field) => (
              <label
                key={field.name}
                className={field.wide ? 'admin-field admin-field--wide' : 'admin-field'}
              >
                {field.label}
                {field.multiline ? (
                  <textarea
                    value={item[field.name] ?? ''}
                    onChange={(e) => update(index, { [field.name]: e.target.value })}
                  />
                ) : (
                  <input
                    type="text"
                    value={item[field.name] ?? ''}
                    onChange={(e) => update(index, { [field.name]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <button
              type="button"
              className="admin-remove"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        )}
      />
      <button
        type="button"
        className="admin-add"
        onClick={() => onChange([...items, { ...emptyItem, id: `item-${Date.now()}` }])}
      >
        Add to {heading.toLowerCase()}
      </button>
    </>
  );
}
