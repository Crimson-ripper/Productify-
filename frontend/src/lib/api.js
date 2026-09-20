import axios from "axios";
export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("productify-token");
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
export const money = (n, ccy = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(Number(n || 0));
