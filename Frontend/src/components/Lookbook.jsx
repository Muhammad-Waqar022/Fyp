import storeImage from '../assets/neon clothinnnggg.jpg';
import './Lookbook.css';

function Lookbook() {
  return (
    <section className="lookbook" id="lookbook" aria-labelledby="lookbook-title">
      <div className="lookbook-image">
        <img src={storeImage} alt="Warmly lit vintage clothing archive" loading="lazy" />
        <span>NEON ARCHIVE / ISSUE 01</span>
      </div>

      <div className="lookbook-copy">
        <p className="lookbook-kicker">A CLOSER LOOK</p>
        <p className="lookbook-issue">THE ART OF FINDING SOMETHING DIFFERENT</p>
        <h2 id="lookbook-title">Good style has a past.</h2>
        <p className="lookbook-description">
          Take your time with the details. Discover vintage pieces chosen for
          their character, texture, and the stories they carry.
        </p>
        <a href="#collections">Explore the curated drops <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  );
}

export default Lookbook;
