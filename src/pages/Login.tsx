
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

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email").or(z.string().min(0)),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Updated admin credentials
const DEFAULT_ADMIN_EMAIL = "applicanyrenters@gmail.com";

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: DEFAULT_ADMIN_EMAIL,
      password: "", // Don't prefill password for security
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
            <CardTitle className="text-center text-2xl">Welcome Back</CardTitle>
            <CardDescription className="text-center">Sign in to access your property management dashboard</CardDescription>
          </CardHeader>
          <CardContent>
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
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-gray-500 py-4 border-t bg-gray-50">
            <p>© 2021-2025 Applicancy Renters. All rights reserved.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
