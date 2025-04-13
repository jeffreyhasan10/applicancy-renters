import Dashboard from "./Dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        console.log("User not authenticated, redirecting to login");
        navigate('/login');
      } else {
        const hasShownToast = sessionStorage.getItem("hasShownWelcomeToast");

        if (!hasShownToast) {
          console.log("User authenticated, showing dashboard toast");
          toast({
            title: "Welcome to Applicancy Renters",
            description: "You are now logged in to the premium property management system",
            duration: 3000,
            className: "bg-luxury-gold text-luxury-charcoal border-none",
          });
          sessionStorage.setItem("hasShownWelcomeToast", "true");
        }
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-luxury-softwhite to-luxury-cream px-4"
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 text-luxury-gold" />
          </motion.div>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-luxury-charcoal text-lg font-semibold tracking-wide"
          >
            Preparing your luxury dashboard...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  if (user) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Dashboard />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-luxury-softwhite to-luxury-cream"
    >
      <div className="flex flex-col items-center space-y-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Loader2 className="h-10 w-10 text-luxury-gold" />
        </motion.div>
        <p className="text-luxury-charcoal text-lg font-semibold tracking-wide">
          Redirecting to login...
        </p>
      </div>
    </motion.div>
  );
};

export default Index;
