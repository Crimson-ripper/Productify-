import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Search, ShoppingBag, UserRound, Menu, X, LogOut, LayoutDashboard, ShieldCheck, Package, Zap, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useEffect, useRef, useState } from "react";

// Compute journey first, then the marketplace.
const NAV = [
  { to: "/rent-compute", label: "Rent compute", testid: "nav-rent-compute-link" },
  { to: "/rentals", label: "GPU rentals", testid: "nav-rentals-link" },
  { to: "/earn-with-hardware", label: "Earn with hardware", testid: "nav-earn-link" },
];
const MARKET = [
  { to: "/shop", label: "Shop", testid: "nav-shop-link" },
  { to: "/sell", label: "Sell", testid: "nav-sell-link" },
  { to: "/gamezone", label: "Gamezone", testid: "nav-gamezone-link" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);
  const accountRef = useRef(null);
  const isAdmin = user && (user.role === "admin" || user.role === "sub-admin");
  const firstName = user?.name ? user.name.split(" ")[0] : "Account";
  const close = () => setMenuOpen(false);

  // Close menus on navigation, Escape, or a click outside.
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setAccountOpen(false); setSearchOpen(false); setMenuOpen(false); } };
    const onDown = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, []);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) { navigate(`/shop?q=${encodeURIComponent(q.trim())}`); setSearchOpen(false); }
  };

  return (
    <>
      <header className="topbar nb">
        <Link to="/" className="brand" data-testid="brand-link" aria-label="Productify home">
          <span className="brand-mark">P</span>
          <span>productify<span className="brand-dot">.</span></span>
        </Link>

        <nav className="main-nav nb-links" data-testid="main-navigation" aria-label="Main">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} data-testid={n.testid}>{n.label}</NavLink>)}
          <span className="nb-sep" aria-hidden="true" />
          {MARKET.map((n) => <NavLink key={n.to} to={n.to} data-testid={n.testid} className="nb-market">{n.label}</NavLink>)}
        </nav>

        <div className="header-actions nb-actions">
          <form className={searchOpen ? "nb-search is-open" : "nb-search"} onSubmit={onSearch} role="search" data-testid="header-search-form">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => !q && setSearchOpen(false)}
              placeholder="Search the shop"
              aria-label="Search the shop"
              data-testid="header-search-input"
              tabIndex={searchOpen ? 0 : -1}
            />
            <button type={searchOpen ? "submit" : "button"} className="nb-icon" aria-label={searchOpen ? "Search" : "Open search"}
              onClick={(e) => { if (!searchOpen) { e.preventDefault(); setSearchOpen(true); } }}>
              <Search size={19} />
            </button>
          </form>

          <Link to="/cart" className="nb-icon nb-bag bag-button" data-testid="cart-button" aria-label={`Bag, ${cart.length} item${cart.length === 1 ? "" : "s"}`}>
            <ShoppingBag size={19} />
            {cart.length > 0 && <b>{cart.length}</b>}
          </Link>

          <div className="account-wrap nb-account" ref={accountRef}>
            {user ? (
              <button className="nb-user icon-text" onClick={() => setAccountOpen((s) => !s)} aria-expanded={accountOpen} aria-haspopup="menu" aria-label={`Account menu for ${firstName}`} data-testid="account-button">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="nb-avatar" />
                  : <span className="nb-avatar nb-initial" aria-hidden="true">{firstName[0]}</span>}
                <span>{firstName}</span>
                <ChevronDown size={15} className={accountOpen ? "nb-chev is-open" : "nb-chev"} />
              </button>
            ) : (
              <button className="nb-signin icon-text" onClick={() => navigate("/login")} aria-label="Sign in" data-testid="account-button">
                <UserRound size={17} /> <span>Sign in</span>
              </button>
            )}
            {user && accountOpen && (
              <div className="account-menu" data-testid="account-menu" role="menu">
                <div className="nb-menu-head"><b>{user.name || "Your account"}</b><small>{user.email}</small></div>
                <Link to="/profile" role="menuitem" data-testid="menu-profile-link"><UserRound size={15} /> Profile</Link>
                <Link to="/orders" role="menuitem" data-testid="menu-orders-link"><ShoppingBag size={15} /> Orders</Link>
                <Link to="/instances" role="menuitem" data-testid="menu-instances-link"><Zap size={15} /> My instances</Link>
                {isAdmin ? (
                  <Link to="/dashboard" role="menuitem" className="menu-admin" data-testid="menu-admin-link"><ShieldCheck size={15} /> Admin console</Link>
                ) : (
                  <Link to="/dashboard" role="menuitem" data-testid="menu-dashboard-link"><LayoutDashboard size={15} /> Dashboard</Link>
                )}
                <Link to="/seller-studio" role="menuitem" data-testid="menu-seller-link"><Package size={15} /> Seller studio</Link>
                <button role="menuitem" className="nb-signout" onClick={() => { logout(); navigate("/"); }} data-testid="menu-signout-button"><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>

          <button className="mobile-menu nb-icon" onClick={() => setMenuOpen((s) => !s)} aria-label="Menu" aria-expanded={menuOpen} data-testid="mobile-menu-button">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
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
          {MARKET.map((n) => <Link key={n.to} to={n.to} onClick={close}>{n.label}</Link>)}
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
            <Link to="/login" onClick={close} className="nb-drawer-signin">Sign in</Link>
          )}
        </div>
      )}
    </>
  );
}
