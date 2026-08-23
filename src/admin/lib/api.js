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
  return res.json();
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
