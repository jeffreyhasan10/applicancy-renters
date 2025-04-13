import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  loading: boolean;
  isAdmin: boolean;
}

// Admin email for role checking
const DEFAULT_ADMIN_EMAIL = "applicanyrenters@gmail.com";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the context hook separately to be compatible with Fast Refresh
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [signInToastShown, setSignInToastShown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // First check for an existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Existing session check:", session?.user?.email);

        if (session) {
          setSession(session);
          setUser(session.user);
          setIsAdmin(session.user?.email === DEFAULT_ADMIN_EMAIL);
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setLoading(false);
        setInitialCheckDone(true);
      }
    };

    checkSession();

    // Set up auth state listener AFTER initial check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (event === "SIGNED_IN") {
          setSession(session);
          setUser(session?.user ?? null);
          setIsAdmin(session?.user?.email === DEFAULT_ADMIN_EMAIL);

          // Only show toast and navigate if initial check is done AND we haven't shown toast yet
          if (initialCheckDone && !signInToastShown) {
            console.log("User signed in, redirecting to dashboard");
            toast({
              title: "Welcome back!",
              description: "You have successfully signed in.",
            });
            setSignInToastShown(true); // Prevent showing toast again
            navigate("/");
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setSignInToastShown(false); // Reset toast flag on sign out

          console.log("User signed out, redirecting to login");
          toast({
            title: "Signed out",
            description: "You have successfully signed out.",
          });
          navigate("/login");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, initialCheckDone, signInToastShown]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const loginEmail = email.trim();
      console.log("Attempting sign in with:", loginEmail);

      // Try signing in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      console.log("Sign in response:", data?.user?.email);

      // If sign-in fails with invalid credentials, try to create the account for admin email
      if (signInError) {
        console.log("Sign in error:", signInError.message);

        if (loginEmail === DEFAULT_ADMIN_EMAIL) {
          console.log("Creating admin account...");
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: loginEmail,
            password,
            options: {
              data: {
                role: "admin",
              },
            },
          });

          console.log("Sign up response:", signUpData?.user?.email);

          if (signUpError) {
            console.error("Error creating admin account:", signUpError);
            throw signUpError;
          }

          // Try signing in again after account creation
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
          });

          if (retryError) {
            console.error("Error signing in after account creation:", retryError);
            throw retryError;
          }
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      toast({
        title: "Sign in failed",
        description: error.message || "An error occurred during sign in",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // State will be updated by the auth listener
    } catch (error: any) {
      toast({
        title: "Sign out failed",
        description: error.message || "An error occurred during sign out",
        variant: "destructive",
      });
      throw error;
    }
  };

  const changePassword = async (newPassword: string) => {
    setLoading(true);
    try {
      if (!user) {
        throw new Error("No user is currently signed in");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Password change error:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Your password has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        title: "Password change failed",
        description: error.message || "An error occurred while changing password",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signOut, changePassword, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}