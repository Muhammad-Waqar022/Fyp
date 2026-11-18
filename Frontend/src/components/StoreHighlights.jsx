import './StoreHighlights.css';

const highlights = [
  {
    number: '01',
    title: 'One of one',
    description: 'Find pieces with a character all their own.',
  },
  {
    number: '02',
    title: 'Curated by hand',
    description: 'A considered edit, selected for individual style.',
  },
  {
    number: '03',
    title: 'Style in a new cycle',
    description: 'Give great garments another chapter.',
  },
];

function StoreHighlights() {
  return (
    <section className="store-highlights" aria-labelledby="store-highlights-title">
      <div className="store-highlights-heading">
        <p>THE NEON POINT OF VIEW</p>
        <h2 id="store-highlights-title">A little different. By design.</h2>
      </div>

      <div className="store-highlights-grid">
        {highlights.map((highlight) => (
          <article className="store-highlight" key={highlight.number}>
            <span>{highlight.number}</span>
            <h3>{highlight.title}</h3>
            <p>{highlight.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StoreHighlights;
