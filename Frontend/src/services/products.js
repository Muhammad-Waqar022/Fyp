const apiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const productsUrl = `${apiOrigin}/api/v1/products`;

export async function fetchProducts({ category, page = 1, limit = 24, signal } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) query.set('category', category);

  let response;
  try {
    response = await fetch(`${productsUrl}?${query}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Unable to connect to the product service. Check the backend connection and VITE_API_URL.',
      { cause: error },
    );
  }

  if (!response.ok) {
    let message;
    try {
      const errorResult = await response.json();
      message = errorResult.message;
    } catch {
      // Non-JSON proxy and server errors are reported by status below.
    }
    throw new Error(
      message || `Product API returned HTTP ${response.status}. Check that the backend is running.`,
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The product service returned an invalid response.');
  }

  if (!result || !result.success) {
    throw new Error(result && result.message ? result.message : 'Products could not be loaded.');
  }

  const { products, categories, pagination, currency } = result.data || {};
  if (!Array.isArray(products) || !Array.isArray(categories) || !pagination) {
    throw new Error('The product service returned an unexpected response.');
  }

  return { products, categories, pagination, currency };
}

export function getProductImageUrl(image) {
  if (!image) return '';
  if (/^(https?:)?\/\//i.test(image) || image.startsWith('data:')) return image;
  return `${apiOrigin}${image.startsWith('/') ? '' : '/'}${image}`;
}
