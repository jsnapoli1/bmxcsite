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

// --- Media -------------------------------------------------------------

export const listMedia = () => request('/media');

/**
 * Uploads a file as multipart/form-data. Deliberately bypasses `request()`:
 * that helper always sets `content-type: application/json` whenever a body
 * is present, which would corrupt a multipart body that needs its own
 * browser-generated boundary in the content-type header instead.
 */
export async function uploadMedia(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/admin/media', { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Something went wrong', res.status);
  }

  return res.json().catch(() => {
    throw new ApiError(
      'Your session may have expired. Reload the page and sign in again.',
      res.status,
    );
  });
}

export const updateMedia = (key, input) =>
  request(`/media/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify(input) });

export const publishMedia = (key) =>
  request(`/media/${encodeURIComponent(key)}/publish`, { method: 'POST' });

export const unpublishMedia = (key) =>
  request(`/media/${encodeURIComponent(key)}/unpublish`, { method: 'POST' });

export const deleteMedia = (key) =>
  request(`/media/${encodeURIComponent(key)}`, { method: 'DELETE' });

// --- Blog ----------------------------------------------------------------

export const listPosts = () => request('/blog');
export const getPost = (slug) => request(`/blog/${encodeURIComponent(slug)}`);

export const savePost = (post) => (
  post.slug
    ? request(`/blog/${encodeURIComponent(post.slug)}`, { method: 'PUT', body: JSON.stringify(post) })
    : request('/blog', { method: 'POST', body: JSON.stringify(post) })
);

export const publishPost = (slug) =>
  request(`/blog/${encodeURIComponent(slug)}/publish`, { method: 'POST' });

export const deletePost = (slug) =>
  request(`/blog/${encodeURIComponent(slug)}`, { method: 'DELETE' });

// --- Store (OpenShop, proxied) -------------------------------------------
//
// These reach the OpenShop worker through worker/routes/shop.js, which
// verifies Access and the `merch` permission and then attaches a credential
// the browser never holds. From here it is an ordinary admin API call.

export const listShopProducts = () => request('/shop/products');

export const getShopProduct = (id) =>
  request(`/shop/products/${encodeURIComponent(id)}`);

export const saveShopProduct = (product) => (
  product.id
    ? request(`/shop/products/${encodeURIComponent(product.id)}`,
      { method: 'PUT', body: JSON.stringify(product) })
    : request('/shop/products', { method: 'POST', body: JSON.stringify(product) })
);

export const deleteShopProduct = (id) =>
  request(`/shop/products/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listShopCollections = () => request('/shop/collections');
