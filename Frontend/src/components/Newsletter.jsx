
import React from 'react';
import './Newsletter.css';

const Newsletter = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for subscribing!');
  };

  return (
    <section className="newsletter">

      <p>STAY IN THE LOOP</p>

      <h2>NEVER MISS A DROP.</h2>

      <span>
        Get updates about new collections and exclusive releases.
      </span>

      <form onSubmit={handleSubmit}>

        <input
          type="email"
          placeholder="Enter your email address"
          required
        />

        <button type="submit">
          SUBSCRIBE →
        </button>

      </form>

    </section>
  );
};

export default Newsletter;
