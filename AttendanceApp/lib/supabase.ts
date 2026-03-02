import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://qdevhyynyqrjkhgiqhjp.supabase.co';    
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkZXZoeXlueXFyamtoZ2lxaGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjExNTAsImV4cCI6MjA4NzgzNzE1MH0.RdQMbKbXMqQYmP96bTG9-y4DDVIazziqV028SMFOqqY';



export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
