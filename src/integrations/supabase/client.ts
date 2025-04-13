
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://wfnekaiujwszsyzihwij.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbmVrYWl1andzenN5emlod2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NzkyMDUsImV4cCI6MjA1OTQ1NTIwNX0.ZwDW6sl3TrZ7s4GfCGjFAshpNIgezc0md4-9QvaJ1qQ";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: localStorage,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
});

// Simplified typed helpers for Supabase tables
export const typedSupabase = {
  from: <T extends keyof Database['public']['Tables']>(table: T) => {
    return supabase.from(table);
  },
  
  // Helper for tenants table
  tenants: () => {
    return supabase.from('tenants');
  },
  
  // Helper for flats table
  flats: () => {
    return supabase.from('flats');
  },
  
  // Helper for property_photos table
  propertyPhotos: () => {
    return supabase.from('property_photos');
  },
  
  // Helper for property_documents table
  propertyDocuments: () => {
    return supabase.from('property_documents');
  },
  
  // Helper for whatsapp_messages table
  whatsappMessages: () => {
    return supabase.from('whatsapp_messages');
  },
  
  // Helper for reminders table
  reminders: () => {
    return supabase.from('reminders');
  },
  
  // Helper for rents table
  rents: () => {
    return supabase.from('rents');
  },
  
  // Helper for storage
  storage: {
    from: (bucket: string) => {
      return supabase.storage.from(bucket);
    }
  }
};
