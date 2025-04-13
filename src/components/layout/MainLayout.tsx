import { ReactNode, useEffect } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useLocation } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-luxury-softwhite flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 md:pl-64 transition-all duration-300 ease-in-out">
        <Navbar />
        <main className="p-4 md:p-6 animate-fade-in">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
