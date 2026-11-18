
import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (
    <header className="topbar">

      {/* NEON Logo */}
      <div className="brand">
        NEON
      </div>

      {/* Navigation Links */}
      <nav className="main-nav">
        <a href="/">HOME</a>
        <a href="#shop">SHOP</a>
        <a href="#men">MEN</a>
        <a href="#women">WOMEN</a>
        <a href="#accessories">ACCESSORIES</a>
        <a href="#contact">CONTACT</a>
      </nav>

      {/* Right Side Icons */}
      <div className="nav-icons">

        <button aria-label="Search">
          ⌕
        </button>

        <a href="/login">LOGIN</a>

        <button aria-label="Cart">
          🛍
        </button>

      </div>

    </header>
  );
};

export default Navbar;
