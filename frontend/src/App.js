import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import Rentals from "@/pages/Rentals";
import ProductDetail from "@/pages/ProductDetail";
import RentalDetail from "@/pages/RentalDetail";
import Sell from "@/pages/Sell";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import PaymentProcessing from "@/pages/PaymentProcessing";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import Orders from "@/pages/Orders";
import DashboardHome from "@/pages/DashboardHome";
import SellerDashboard from "@/pages/SellerDashboard";
import SellerOnboarding from "@/pages/SellerOnboarding";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import Terms from "@/pages/policies/Terms";
import Refund from "@/pages/policies/Refund";
import Cookies from "@/pages/policies/Cookies";
import AcceptableUse from "@/pages/policies/AcceptableUse";
import Contact from "@/pages/policies/Contact";
import CookieBanner from "@/components/CookieBanner";
import PolicyBumpModal from "@/components/PolicyBumpModal";

function AppRouter() {
  const location = useLocation();
  // Detect Emergent OAuth callback via URL fragment — must happen before other route logic
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/rental/:id" element={<RentalDetail />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/payment/processing" element={<ProtectedRoute><PaymentProcessing /></ProtectedRoute>} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
          <Route path="/seller/onboarding" element={<SellerOnboarding />} />
          <Route path="/become-seller" element={<SellerOnboarding />} />
          <Route path="/seller-studio" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/studio" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/refunds" element={<Refund />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/legal/acceptable-use" element={<AcceptableUse />} />
          <Route path="/legal/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CookieBanner />
      <PolicyBumpModal />
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
