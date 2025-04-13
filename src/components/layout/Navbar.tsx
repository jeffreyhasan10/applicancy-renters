import { LogOut, Search, Settings, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import NotificationDropdown from "@/components/common/NotificationDropdown";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  }).format(new Date());

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem logging out",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center px-4 md:px-6 shadow-sm">
      <div className="flex-1">
        {/* Search bar hidden on small screens */}
        <div className="hidden md:block relative w-64 md:w-80">
          <input
            type="text"
            placeholder="Search properties, tenants..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-luxury-gold focus:border-transparent transition-all duration-200"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 md:space-x-5">
        {/* Notification dropdown hidden on small screens */}
        <div className="hidden md:block">
          <NotificationDropdown />
        </div>

        {/* Divider hidden on small screens */}
        <span className="hidden md:block h-6 w-px bg-gray-200" aria-hidden="true"></span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-gray-800">{formattedDate}</p>
                <p className="text-xs text-gray-500">Welcome, {user?.email?.split('@')[0] || 'User'}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-luxury-gold to-amber-500 flex items-center justify-center text-luxury-charcoal shadow-sm">
                <User className="h-5 w-5" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
