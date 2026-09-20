import { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

const KEY = "productify-cart";

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)); }, [cart]);
  const add = (item, kind = "product") => {
    setCart((c) => [...c, { id: item.id, title: item.title, price: item.price, image: item.image, kind, quantity: 1 }]);
  };
  const remove = (idx) => setCart((c) => c.filter((_, i) => i !== idx));
  const clear = () => setCart([]);
  const subtotal = cart.reduce((a, x) => a + Number(x.price) * (x.quantity || 1), 0);
  return <CartCtx.Provider value={{ cart, setCart, add, remove, clear, subtotal }}>{children}</CartCtx.Provider>;
}
