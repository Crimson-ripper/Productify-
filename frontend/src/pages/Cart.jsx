import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { money } from "@/lib/api";
import SEO from "@/components/SEO";

export default function Cart() {
  const { cart, remove, subtotal } = useCart();
  const navigate = useNavigate();
  return (
    <>
      <SEO title="Your bag — Productify" description="Review your items and continue to checkout." path="/cart" />
      <section className="cart-page">
        <div className="cart-head">
          <div className="eyebrow">Your bag</div>
          <h1>{cart.length === 0 ? "Your bag is empty" : `${cart.length} item${cart.length === 1 ? "" : "s"}`}</h1>
        </div>
        {cart.length === 0 ? (
          <div className="empty-state large">
            <ShoppingBag size={38} />
            <p>Anything you add from the shop shows up here.</p>
            <Link to="/shop" className="primary-button" data-testid="cart-empty-shop-button">Browse products <ArrowRight size={17} /></Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-lines" data-testid="cart-lines">
              {cart.map((x, i) => (
                <div className="cart-line-lg" key={`${x.id}-${i}`}>
                  <img src={x.image} alt="" />
                  <div>
                    <Link to={x.kind === "rental" ? `/rental/${x.id}` : `/product/${x.id}`}><b>{x.title}</b></Link>
                    <small>{x.kind === "rental" ? "GPU rental · per hour" : "Digital product"}</small>
                  </div>
                  <strong>{money(x.price)}</strong>
                  <button onClick={() => remove(i)} aria-label={`Remove ${x.title}`} data-testid={`cart-remove-${i}-button`}><X size={16} /></button>
                </div>
              ))}
            </div>
            <aside className="cart-summary">
              <h3>Order summary</h3>
              <div className="row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <div className="row muted"><span>Tax (5%)</span><span>{money(subtotal * 0.05)}</span></div>
              <div className="row total"><span>Total</span><strong>{money(subtotal * 1.05)}</strong></div>
              <button className="primary-button full" onClick={() => navigate("/checkout")} data-testid="cart-checkout-button">Checkout <ArrowRight size={17} /></button>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
