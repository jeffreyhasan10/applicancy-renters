import {
  Building2,
  HomeIcon,
  LayoutDashboard,
  MessageSquareWarning,
  Package2,
  Receipt,
  IndianRupee,
  Settings,
  Users2,
  ChevronRight,
  LogOut,
  Link,
  Menu,
  X,
  Plug,
} from "lucide-react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Flats", href: "/flats", icon: Building2 },
  { name: "Tenants", href: "/tenants", icon: Users2 },
  { name: "Rent", href: "/rent", icon: Receipt },
  { name: "Payment Links", href: "/payment-links", icon: Link },
  { name: "Inventory", href: "/inventory", icon: Package2 },
  { name: "Appliances", href: "/appliances", icon: Plug }, // Added
  { name: "Reminders", href: "/reminders", icon: MessageSquareWarning },
  { name: "Expenses", href: "/expenses", icon: IndianRupee },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Get user display name and initials
  const displayName = user?.email ? user.email.split("@")[0] : "Admin";
  const userInitials = displayName.charAt(0).toUpperCase();

  // Handle click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu toggle button for smaller screens */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-luxury-charcoal text-luxury-gold p-2 rounded-full shadow-lg hover:bg-luxury-charcoal/80 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-luxury-charcoal border-r border-sidebar-border flex flex-col transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out md:w-64 shadow-2xl md:shadow-none`}
      >
        <div className="h-24 flex flex-col items-center justify-center px-4 border-b border-sidebar-border bg-gradient-to-b from-sidebar-accent to-luxury-charcoal">
          <img
            src="/assets/applicancy.png"
            alt="Applicancy Renters Logo"
            className="h-16 w-auto transition-transform duration-300 hover:scale-105"
          />
          <span className="text-xs font-medium text-luxury-gold mt-1 tracking-wider">
            Since 2021
          </span>
        </div>

        <nav className="flex-1 px-3 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent scrollbar-track-luxury-charcoal">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <li key={item.name}>
                  <RouterLink
                    to={item.href}
                    className={`group flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                      isActive
                        ? "bg-sidebar-accent text-white shadow-inner"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={`mr-3 h-5 w-5 transition-colors duration-200 ${
                          isActive ? "text-luxury-gold" : "group-hover:text-luxury-gold"
                        }`}
                      />
                      <span className="tracking-wide">{item.name}</span>
                    </div>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 text-luxury-gold animate-pulse" />
                    )}
                    {/* Hover effect */}
                    <div
                      className={`absolute inset-y-0 left-0 w-1 bg-luxury-gold transform transition-transform duration-200 ${
                        isActive ? "translate-x-0" : "-translate-x-full group-hover:translate-x-0"
                      }`}
                    />
                  </RouterLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-sidebar-border bg-gradient-to-t from-sidebar-accent/40 to-luxury-charcoal">
          <div className="flex items-center justify-between group">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-luxury-gold to-amber-500 flex items-center justify-center text-luxury-charcoal font-semibold shadow-lg transition-transform duration-200 group-hover:scale-110">
                  {userInitials}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white tracking-tight">
                  Administrator
                </p>
                <p className="text-xs text-gray-300 truncate max-w-[150px]">
                  {user?.email || "admin@applicanyrenters.com"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-red-800/30 transition-colors duration-200"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}