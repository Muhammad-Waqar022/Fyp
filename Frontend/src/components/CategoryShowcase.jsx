import './CategoryShowcase.css';

const categories = [
  {
    name: 'Outerwear',
    note: 'Layers with a past',
    image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=900',
  },
  {
    name: 'Denim',
    note: 'Made to live in',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=900',
  },
  {
    name: 'Blazers',
    note: 'A sharper point of view',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900',
  },
];

function CategoryShowcase() {
  return (
    <section className="category-showcase" aria-labelledby="category-showcase-title">
      <div className="category-showcase-header">
        <div>
          <p className="category-showcase-kicker">SHOP THE ARCHIVE</p>
          <h2 id="category-showcase-title">Find your next favorite.</h2>
        </div>
        <a href="#collections">View all drops <span aria-hidden="true">↗</span></a>
      </div>

      <div className="category-showcase-grid">
        {categories.map((category, index) => (
          <a
            className="category-showcase-card"
            href="#collections"
            key={category.name}
            aria-label={`Explore ${category.name} in curated drops`}
          >
            <img src={category.image} alt="" loading="lazy" />
            <span className="category-showcase-index">0{index + 1} / THE EDIT</span>
            <div className="category-showcase-copy">
              <span>{category.note}</span>
              <h3>{category.name}</h3>
              <span className="category-showcase-link">Explore the edit <span aria-hidden="true">↗</span></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export default CategoryShowcase;
