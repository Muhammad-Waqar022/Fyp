
import React from 'react';
import './Hero.css';

const Hero = () => {
  return (
    <section className="hero" id="shop">

      <div className="hero-content">

        <span className="hero-badge">
          NEW ARRIVALS
        </span>

        <h1>
          THRIFTED.
          <br />
          CURATED.
        </h1>

        <p>
          Premium thrifted pieces, handpicked for
          style, quality, and uniqueness.
        </p>

        <div className="hero-buttons">
          <a href="#collections" className="shop-btn">
            SHOP NOW →
          </a>

          <a href="#lookbook" className="lookbook-btn">
            EXPLORE LOOKBOOK
          </a>
        </div>

        <div className="hero-stats">

          <div>
            <h3>100%</h3>
            <span>AUTHENTICATED</span>
          </div>

          <div>
            <h3>1-of-1</h3>
            <span>UNIQUE CUTS</span>
          </div>

          <div>
            <h3>ECO-FIRST</h3>
            <span>CIRCULAR WEAR</span>
          </div>

        </div>

      </div>

      <div className="showroom-label">
        TOKYO SHOWROOM & ARCHIVE LAB
      </div>

    </section>
  );
};

export default Hero;
