export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Something went wrong', res.status);
  }

  // A 2xx response is not guaranteed to be JSON: an expired Cloudflare
  // Access session answers with a 200 login page (HTML), not the API
  // response the caller expects. Surface that as a normal ApiError with a
  // message a camp director can act on, instead of letting the raw
  // SyntaxError from a failed JSON parse reach the UI.
  return res.json().catch(() => {
    throw new ApiError(
      'Your session may have expired. Reload the page and sign in again.',
      res.status,
    );
  });
}

export const getMe = () => request('/me');
export const listUsers = () => request('/users');

export const createUser = (input) =>
  request('/users', { method: 'POST', body: JSON.stringify(input) });

export const updateUser = (email, input) =>
  request(`/users/${encodeURIComponent(email)}`,
    { method: 'PATCH', body: JSON.stringify(input) });

export const deleteUser = (email) =>
  request(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' });

export const getContent = (area) => request(`/content/${area}`);

export const saveContent = (area, body) =>
  request(`/content/${area}`, { method: 'PUT', body: JSON.stringify(body) });

export const publishContent = (area) =>
  request(`/content/${area}/publish`, { method: 'POST' });
