import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email").or(z.string().min(0)),
  password: z.string().min(1, "Password is required"),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Updated admin credentials
const DEFAULT_ADMIN_EMAIL = "applicanyrenters@gmail.com";

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: DEFAULT_ADMIN_EMAIL,
      password: "", // Don't prefill password for security
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: DEFAULT_ADMIN_EMAIL,
    },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      console.log("Form submission with:", data.email);
      await signIn(data.email, data.password);
      
      toast({
        title: "Login successful",
        description: "Welcome back to Applicancy Renters",
      });
      
      // Navigate to dashboard after successful login
      navigate('/');
    } catch (error) {
      console.error("Login error:", error);
      // Toast is already shown in the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Send password reset email through Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: window.location.origin + '/reset-password', // Redirect to a page where users can set their new password
      });
      
      if (error) {
        throw error;
      }
      
      // Set flag to show success message
      setResetEmailSent(true);
      
      toast({
        title: "Password reset email sent",
        description: "Please check your email for a link to reset your password",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast({
        title: "Password reset failed",
        description: error.message || "An error occurred during password reset",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle between login and password reset forms
  const togglePasswordReset = () => {
    setShowPasswordReset(!showPasswordReset);
    setResetEmailSent(false);
    // Reset form states when toggling
    loginForm.reset({
      email: DEFAULT_ADMIN_EMAIL,
      password: "",
    });
    resetPasswordForm.reset({
      email: DEFAULT_ADMIN_EMAIL,
    });
  };

  // If the user is already logged in, redirect to the dashboard
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (user && !loading) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-luxury-softwhite to-luxury-pearl py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-4">
            <img 
              src="/assets/applicancy.png" 
              alt="Applicancy Renters Logo" 
              className="h-24"
            />
          </div>
          <p className="mt-2 text-luxury-slate">Premium Property Management System · Since 2021</p>
        </div>

        <Card className="border-0 shadow-xl bg-white overflow-hidden animate-fade-in">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {showPasswordReset ? "Reset Password" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-center">
              {showPasswordReset 
                ? "Enter your email to receive a password reset link" 
                : "Sign in to access your property management dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showPasswordReset ? (
              resetEmailSent ? (
                <div className="text-center py-4 space-y-4">
                  <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
                    <h3 className="text-green-800 font-medium">Email Sent Successfully</h3>
                    <p className="text-green-700 mt-1">
                      Please check your inbox for a password reset link. The link will expire in 24 hours.
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline"
                    className="w-full"
                    onClick={togglePasswordReset}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <Form {...resetPasswordForm}>
                  <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={resetPasswordForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="Enter your email address" 
                              {...field} 
                              className="border-gray-200 focus:border-luxury-gold focus:ring-luxury-gold"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <Button 
                        type="submit" 
                        className="w-full bg-luxury-charcoal hover:bg-gray-800 text-white"
                        disabled={isSubmitting || loading}
                      >
                        {(isSubmitting || loading) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending email...
                          </>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        className="w-full"
                        onClick={togglePasswordReset}
                        disabled={isSubmitting || loading}
                      >
                        Back to Login
                      </Button>
                    </div>
                  </form>
                </Form>
              )
            ) : (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="applicanyrenters@gmail.com"
                            {...field} 
                            className="border-gray-200 focus:border-luxury-gold focus:ring-luxury-gold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password" 
                            {...field} 
                            className="border-gray-200 focus:border-luxury-gold focus:ring-luxury-gold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full bg-luxury-charcoal hover:bg-gray-800 text-white"
                    disabled={isSubmitting || loading}
                  >
                    {(isSubmitting || loading) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      onClick={togglePasswordReset}
                      className="text-luxury-gold hover:text-luxury-charcoal text-sm underline"
                      disabled={isSubmitting || loading}
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-gray-500 py-4 border-t bg-gray-50">
            <p>© 2021-2025 Applicancy Renters. All rights reserved.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}