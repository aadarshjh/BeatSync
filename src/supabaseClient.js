import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eypvsphqxkvhrbnnqnms.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cHZzcGhxeGt2aHJibm5xbm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTQ5NzQsImV4cCI6MjA4NzA3MDk3NH0.kjHUQn7t95DA92C1K9bsCKG-4OnIKAUTa0E4wSjJvMU";

export const supabase = createClient(supabaseUrl, supabaseKey);
