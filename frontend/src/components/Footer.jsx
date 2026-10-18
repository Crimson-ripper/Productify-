import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer data-testid="site-footer">
      <div className="footer-grid">
        <div>
          <Link to="/" className="brand"><span className="brand-mark">P</span><span>productify<span className="brand-dot">.</span></span></Link>
          <p className="footer-tag">Rent GPU compute, or earn with your hardware. Closed beta — payments are in test mode.</p>
          <a className="footer-mail" href="mailto:support@productifynow.com">support@productifynow.com</a>
        </div>
        <div className="footer-col">
          <h5>Productify</h5>
          <Link to="/rent-compute">Rent compute</Link>
          <Link to="/earn-with-hardware">Earn with hardware</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/security">Security</Link>
          <Link to="/faq">FAQ</Link>
        </div>
        <div className="footer-col">
          <h5>Shop</h5>
          <Link to="/shop">All products</Link>
          <Link to="/shop?category=Software">Software</Link>
          <Link to="/shop?category=Design">Design</Link>
          <Link to="/shop?category=Development">Development</Link>
          <Link to="/shop?category=Creative">Creative</Link>
        </div>
        <div className="footer-col">
          <h5>Compute</h5>
          <Link to="/rentals">GPU rentals</Link>
          <Link to="/gamezone">Gamezone</Link>
          <Link to="/instances">My instances</Link>
        </div>
        <div className="footer-col">
          <h5>Sellers</h5>
          <Link to="/sell">How selling works</Link>
          <Link to="/seller-studio">Seller studio</Link>
          <Link to="/legal/contact">Contact</Link>
        </div>
        <div className="footer-col">
          <h5>Legal</h5>
          <Link to="/legal/privacy" data-testid="footer-privacy-link">Privacy</Link>
          <Link to="/legal/terms" data-testid="footer-terms-link">Terms</Link>
          <Link to="/legal/refunds" data-testid="footer-refunds-link">Refunds</Link>
          <Link to="/legal/cookies" data-testid="footer-cookies-link">Cookies</Link>
          <Link to="/legal/acceptable-use" data-testid="footer-aup-link">Acceptable use</Link>
        </div>
      </div>
      <div className="footer-bar">
        <span>© {new Date().getFullYear()} Productify</span>
        <span>productifynow.com</span>
      </div>
    </footer>
  );
}
