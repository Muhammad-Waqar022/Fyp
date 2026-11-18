
import React from 'react';

import Announcement from './components/Announcement';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Countdown from './components/Countdown';
import ProductSection from './components/ProductSection';
import ExploreMore from './components/ExploreMore';
import CategoryShowcase from './components/CategoryShowcase';
import Lookbook from './components/Lookbook';
import Philosophy from './components/Philosophy';
import StoreHighlights from './components/StoreHighlights';
import Newsletter from './components/Newsletter';
import Footer from './components/Footer';

function App() {
  return (
    <div className="page-shell">

      <Announcement />

      <Navbar />

      <Hero />

      <Countdown />

      <CategoryShowcase />

      <ProductSection />

      <ExploreMore />

      <Lookbook />

      <Philosophy />

      <StoreHighlights />

      <Newsletter />

      <Footer />

    </div>
  );
}

export default App;
