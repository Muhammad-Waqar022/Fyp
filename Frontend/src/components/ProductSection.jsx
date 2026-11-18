
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts, getProductImageUrl } from '../services/products';
import './ProductSection.css';

const ProductSection = () => {
  const [activeFilter, setActiveFilter] = useState('All Drops');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const loadMoreController = useRef(null);
  const filters = useMemo(() => ['All Drops', ...categories], [categories]);

  useEffect(() => {
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = null;

    async function loadProducts() {
      setLoading(true);
      setError('');
      setProducts([]);
      setPagination(null);
      try {
        const result = await fetchProducts({
          category: activeFilter === 'All Drops' ? undefined : activeFilter,
          signal: controller.signal,
        });
        setProducts(result.products);
        setCategories(result.categories);
        setPagination(result.pagination);
        if (result.currency) setCurrency(result.currency.toUpperCase());
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [activeFilter, reloadKey]);

  async function loadMore() {
    if (!pagination || pagination.page >= pagination.pages || loadingMore) return;
    const controller = new AbortController();
    loadMoreController.current = controller;
    setLoadingMore(true);
    setError('');
    try {
      const result = await fetchProducts({
        category: activeFilter === 'All Drops' ? undefined : activeFilter,
        page: pagination.page + 1,
        signal: controller.signal,
      });
      setProducts((currentProducts) => [...currentProducts, ...result.products]);
      setPagination(result.pagination);
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message);
    } finally {
      if (!controller.signal.aborted) {
        loadMoreController.current = null;
        setLoadingMore(false);
      }
    }
  }

  function formatPrice(price) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(price);
  }

  return (
    <section className="products-section" id="collections">
      <div className="products-header">
        <h2>CURATED DROPS</h2>
        <div className="product-filters">
          {filters.map(filter => (
            <button
              key={filter}
              className={
                activeFilter === filter ? 'active' : ''
              }
              aria-pressed={activeFilter === filter}
              onClick={() => {
                loadMoreController.current?.abort();
                setLoadingMore(false);
                setActiveFilter(filter);
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="products-message" role="status">Loading products...</p>}

      {!loading && error && products.length === 0 && (
        <div className="products-message products-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <p className="products-message">No products are available right now.</p>
      )}

      {!loading && products.length > 0 && (
        <>
          <div className="products-grid">
            {products.map(product => (
              <article className="product-card" key={product._id}>
                <div className="product-image">
                  <span className="product-image-placeholder">Image unavailable</span>
                  {product.image && (
                    <img
                      src={getProductImageUrl(product.image)}
                      alt={product.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  )}
                </div>

                <h3>{product.name}</h3>
                <p>{product.description}</p>

                <div className="product-bottom">
                  <strong>{formatPrice(product.price)}</strong>
                  <span aria-label={`${product.stockQuantity} in stock`}>
                    {product.stockQuantity > 0 ? 'In stock' : 'Sold out'}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {error && (
            <div className="products-message products-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={loadMore}>Try loading more</button>
            </div>
          )}
          {pagination && pagination.page < pagination.pages && (
            <button
              className="load-more-button"
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}

    </section>
  );
};

export default ProductSection;
