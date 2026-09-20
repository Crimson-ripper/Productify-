import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer data-testid="site-footer">
      <div className="footer-grid">
        <div>
          <Link to="/" className="brand"><span className="brand-mark">P</span><span>productify<span className="brand-dot">.</span></span></Link>
          <p className="footer-tag">Tools and compute for the people building tomorrow.</p>
        </div>
        <div className="footer-col">
          <h5>Marketplace</h5>
          <Link to="/shop">All products</Link>
          <Link to="/shop?category=Software">Software</Link>
          <Link to="/shop?category=Design">Design</Link>
          <Link to="/shop?category=Development">Development</Link>
        </div>
        <div className="footer-col">
          <h5>Compute</h5>
          <Link to="/rentals">All nodes</Link>
          <Link to="/rentals?q=RTX">RTX rentals</Link>
          <Link to="/rentals?q=A100">A100 rentals</Link>
          <Link to="/sell">List your node</Link>
        </div>
        <div className="footer-col">
          <h5>Company</h5>
          <Link to="/sell">Sell on Productify</Link>
          <a href="mailto:hello@productifynow.com">Contact</a>
          <a href="/robots.txt">Robots</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </div>
      <div className="footer-bar">
        <span>© {new Date().getFullYear()} Productify · productifynow.com</span>
        <span>Verified sellers · Encrypted checkout · Refund guarantee</span>
      </div>
    </footer>
  );
}
