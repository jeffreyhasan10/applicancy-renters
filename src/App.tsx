import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Tenants from "./pages/Tenants";
import TenantDetail from "./pages/TenantDetail";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Rent from "./pages/Rent";
import Inventory from "./pages/Inventory";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Index from "./pages/Index";
import Expenses from "@/pages/Expenses";
import PaymentVerification from "./pages/PaymentVerification";
import PaymentLinks from "./pages/PaymentLinks";
import Flats from "@/pages/Flats";
import FlatDetail from "@/pages/FlatDetail";
import Appliances from "@/pages/Appliances";

// Create a client with better error handling and staleTime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" closeButton={true} />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route
              path="/payment-verification"
              element={<PaymentVerification />}
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Index />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/flats"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Flats />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/flat/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <FlatDetail />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenants"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Tenants />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenant/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <TenantDetail />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rent"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Rent />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-links"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <PaymentLinks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Inventory />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/appliances"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Appliances />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reminders"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Reminders />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Profile />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Expenses />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;