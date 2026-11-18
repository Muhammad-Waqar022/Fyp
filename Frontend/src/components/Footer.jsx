
import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer" id="contact">

      <div className="footer-main">

        <div className="footer-brand">
          <h2>THRIFTED. CURATED.</h2>

          <p>
            Timeless vintage pieces.
            Curated for individual style.
          </p>
        </div>

        <div className="footer-column">
          <h3>EXPLORE</h3>
          <a href="#shop">New Drops</a>
          <a href="#collections">Collections</a>
          <a href="#about">About Us</a>
        </div>

        <div className="footer-column">
          <h3>SUPPORT</h3>
          <a href="#contact">Contact</a>
          <a href="#contact">Shipping</a>
          <a href="#contact">Returns</a>
        </div>

        <div className="footer-column">
          <h3>FOLLOW US</h3>
          <a href="#instagram">Instagram</a>
          <a href="#facebook">Facebook</a>
          <a href="#pinterest">Pinterest</a>
        </div>

      </div>

      <div className="footer-bottom">
        © 2026 THRIFTED. CURATED. ALL RIGHTS RESERVED.
      </div>

    </footer>
  );
};

export default Footer;
