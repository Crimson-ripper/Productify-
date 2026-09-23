import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, UserRound, Menu, LogOut, LayoutDashboard, ShieldCheck, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [q, setQ] = useState("");
  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <>
      <div className="announcement" data-testid="announcement-bar">
        <span><ShieldCheck size={13} /> Verified sellers · Encrypted checkout · Global compute</span>
        <span className="announcement-link">productifynow.com</span>
      </div>
      <header className="topbar">
        <Link to="/" className="brand" data-testid="brand-link">
          <span className="brand-mark">P</span>
          <span>productify<span className="brand-dot">.</span></span>
        </Link>
        <nav className="main-nav" data-testid="main-navigation">
          <NavLink to="/shop" data-testid="nav-shop-link">Shop</NavLink>
          <NavLink to="/rentals" data-testid="nav-rentals-link">GPU rentals</NavLink>
          <NavLink to="/sell" data-testid="nav-sell-link">Sell on Productify</NavLink>
        </nav>
        <form className="header-search" onSubmit={onSearch} data-testid="header-search-form">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, software, GPUs…"
            data-testid="header-search-input"
          />
        </form>
        <div className="header-actions">
          <div className="account-wrap" onMouseLeave={() => setAccountOpen(false)}>
            <button className="icon-text" onClick={() => (user ? setAccountOpen((s) => !s) : navigate("/login"))} data-testid="account-button">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="avatar-xs" />
              ) : (
                <UserRound size={18} />
              )}
              <span>{user ? user.name.split(" ")[0] : "Account"}</span>
            </button>
            {user && accountOpen && (
              <div className="account-menu" data-testid="account-menu">
                <Link to="/profile" data-testid="menu-profile-link"><UserRound size={14} /> Profile</Link>
                <Link to="/orders" data-testid="menu-orders-link"><ShoppingBag size={14} /> Orders</Link>
                <Link to="/dashboard" data-testid="menu-dashboard-link"><LayoutDashboard size={14} /> Dashboard</Link>
                <Link to="/seller-studio" data-testid="menu-seller-link"><Package size={14} /> Seller Studio</Link>
                <button onClick={() => { logout(); navigate("/"); }} data-testid="menu-signout-button"><LogOut size={14} /> Sign out</button>
              </div>
            )}
          </div>
          <Link to="/cart" className="bag-button" data-testid="cart-button">
            <ShoppingBag size={18} />
            <span>Bag</span>
            <b>{cart.length}</b>
          </Link>
          <button className="mobile-menu" onClick={() => setMenuOpen((s) => !s)} data-testid="mobile-menu-button"><Menu size={20} /></button>
        </div>
      </header>
      {menuOpen && (
        <div className="mobile-drawer" data-testid="mobile-drawer">
          <Link to="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link to="/rentals" onClick={() => setMenuOpen(false)}>GPU rentals</Link>
          <Link to="/sell" onClick={() => setMenuOpen(false)}>Sell on Productify</Link>
          {user ? (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              <Link to="/orders" onClick={() => setMenuOpen(false)}>Orders</Link>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link to="/seller-studio" onClick={() => setMenuOpen(false)}>Seller Studio</Link>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
          )}
        </div>
      )}
    </>
  );
}
