/**
 * Validates a PUT payload's shape before it reaches saveArea(). This exists
 * for two failure modes the repository itself cannot guard against, because
 * saveArea's contract is "replace everything with what I'm given":
 *
 * 1. A body that failed to parse, or that is missing the top-level key the
 *    area expects, must never be treated as "replace with nothing". Content
 *    loss from a dropped connection or a wrong Content-Type must surface as
 *    a 400, not a silent, successful wipe.
 * 2. A malformed entry (wrong type, missing a NOT NULL column's source
 *    field) must be caught here, before db.batch() queues the DELETEs. A
 *    NOT NULL violation from inside the batch is still a 500 either way,
 *    but validating first means well-formed requests never pay for
 *    round-tripping to D1 to discover a shape problem, and a caller gets a
 *    message about which field is wrong rather than a raw SQLite error.
 *
 * Every validator returns `null` for a valid payload, or a human-readable
 * message naming the problem for an invalid one.
 */

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStaff(payload) {
  if (!Array.isArray(payload?.groups)) {
    return 'Payload must include a "groups" array.';
  }
  for (const group of payload.groups) {
    if (!isPlainObject(group) || !isNonEmptyString(group.group)) {
      return 'Each group requires a non-empty "group" name.';
    }
    if (group.members !== undefined && !Array.isArray(group.members)) {
      return 'A group\'s "members" must be an array.';
    }
    for (const member of group.members ?? []) {
      if (!isPlainObject(member) || !isNonEmptyString(member.name)) {
        return 'Each staff member requires a non-empty "name".';
      }
    }
  }
  return null;
}

function validateFaq(payload) {
  if (!Array.isArray(payload?.categories)) {
    return 'Payload must include a "categories" array.';
  }
  for (const category of payload.categories) {
    if (!isPlainObject(category) || !isNonEmptyString(category.label)) {
      return 'Each category requires a non-empty "label".';
    }
    if (category.items !== undefined && !Array.isArray(category.items)) {
      return 'A category\'s "items" must be an array.';
    }
    for (const item of category.items ?? []) {
      if (!isPlainObject(item) || !isNonEmptyString(item.q) || !isNonEmptyString(item.a)) {
        return 'Each FAQ item requires non-empty "q" and "a".';
      }
    }
  }
  return null;
}

function validateMerch(payload) {
  if (!Array.isArray(payload?.items)) {
    return 'Payload must include an "items" array.';
  }
  if (!Array.isArray(payload?.facts)) {
    return 'Payload must include a "facts" array.';
  }
  for (const item of payload.items) {
    if (!isPlainObject(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      return 'Each merch item requires a non-empty "id" and "name".';
    }
  }
  for (const fact of payload.facts) {
    if (!isPlainObject(fact) || !isNonEmptyString(fact.title) || !isNonEmptyString(fact.body)) {
      return 'Each merch fact requires a non-empty "title" and "body".';
    }
  }
  return null;
}

function validateCampInfo(payload) {
  if (!isPlainObject(payload?.fields)) {
    return 'Payload must include a "fields" object.';
  }
  for (const [key, field] of Object.entries(payload.fields)) {
    if (!isPlainObject(field) || !isNonEmptyString(field.value) || !isNonEmptyString(field.label)) {
      return `Field "${key}" requires a non-empty "value" and "label".`;
    }
  }
  return null;
}

const VALIDATORS = {
  staff: validateStaff,
  faq: validateFaq,
  merch: validateMerch,
  campinfo: validateCampInfo,
};

/**
 * Validates `payload` for `area`. Returns `null` when valid, or an
 * error message string when not. An area with no validator (unknown area)
 * is not this module's concern — the repository's UnknownAreaError handles
 * that, so this returns null and lets the request proceed to saveArea().
 */
export function validatePayload(area, payload) {
  const validator = VALIDATORS[area];
  if (!validator) return null;
  return validator(payload);
}
