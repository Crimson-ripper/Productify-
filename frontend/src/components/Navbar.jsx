import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, UserRound, Menu, X, LogOut, LayoutDashboard, ShieldCheck, Package, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";

const NAV = [
  { to: "/shop", label: "Shop", testid: "nav-shop-link" },
  { to: "/rentals", label: "GPU rentals", testid: "nav-rentals-link" },
  { to: "/gamezone", label: "Gamezone", testid: "nav-gamezone-link" },
  { to: "/sell", label: "Sell", testid: "nav-sell-link" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [q, setQ] = useState("");
  const isAdmin = user && (user.role === "admin" || user.role === "sub-admin");
  const close = () => setMenuOpen(false);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" data-testid="brand-link">
          <span className="brand-mark">P</span>
          <span>productify<span className="brand-dot">.</span></span>
        </Link>
        <nav className="main-nav" data-testid="main-navigation">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} data-testid={n.testid}>{n.label}</NavLink>)}
        </nav>
        <form className="header-search" onSubmit={onSearch} data-testid="header-search-form" role="search">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the shop"
            aria-label="Search the shop"
            data-testid="header-search-input"
          />
        </form>
        <div className="header-actions">
          <div className="account-wrap" onMouseLeave={() => setAccountOpen(false)}>
            <button className="icon-text" onClick={() => (user ? setAccountOpen((s) => !s) : navigate("/login"))} data-testid="account-button">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="avatar-xs" /> : <UserRound size={18} />}
              <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
            </button>
            {user && accountOpen && (
              <div className="account-menu" data-testid="account-menu">
                <Link to="/profile" data-testid="menu-profile-link"><UserRound size={14} /> Profile</Link>
                <Link to="/orders" data-testid="menu-orders-link"><ShoppingBag size={14} /> Orders</Link>
                <Link to="/instances" data-testid="menu-instances-link"><Zap size={14} /> My instances</Link>
                {isAdmin ? (
                  <Link to="/dashboard" className="menu-admin" data-testid="menu-admin-link"><ShieldCheck size={14} /> Admin console</Link>
                ) : (
                  <Link to="/dashboard" data-testid="menu-dashboard-link"><LayoutDashboard size={14} /> Dashboard</Link>
                )}
                <Link to="/seller-studio" data-testid="menu-seller-link"><Package size={14} /> Seller studio</Link>
                <button onClick={() => { logout(); navigate("/"); }} data-testid="menu-signout-button"><LogOut size={14} /> Sign out</button>
              </div>
            )}
          </div>
          <Link to="/cart" className="bag-button" data-testid="cart-button" aria-label={`Bag, ${cart.length} items`}>
            <ShoppingBag size={18} />
            <span>Bag</span>
            {cart.length > 0 && <b>{cart.length}</b>}
          </Link>
          <button className="mobile-menu" onClick={() => setMenuOpen((s) => !s)} aria-label="Menu" aria-expanded={menuOpen} data-testid="mobile-menu-button">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="mobile-drawer" data-testid="mobile-drawer">
          <form className="drawer-search" onSubmit={(e) => { onSearch(e); close(); }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the shop" aria-label="Search the shop" />
          </form>
          {NAV.map((n) => <Link key={n.to} to={n.to} onClick={close}>{n.label}</Link>)}
          <hr />
          {user ? (
            <>
              <Link to="/profile" onClick={close}>Profile</Link>
              <Link to="/orders" onClick={close}>Orders</Link>
              <Link to="/instances" onClick={close}>My instances</Link>
              <Link to="/dashboard" onClick={close} className={isAdmin ? "menu-admin" : undefined}>{isAdmin ? "Admin console" : "Dashboard"}</Link>
              <Link to="/seller-studio" onClick={close}>Seller studio</Link>
              <button onClick={() => { logout(); close(); navigate("/"); }}>Sign out</button>
            </>
          ) : (
            <Link to="/login" onClick={close}>Sign in</Link>
          )}
        </div>
      )}
    </>
  );
}
