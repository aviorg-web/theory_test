import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://edcgpqfscpzuvqaxifdj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2dwcWZzY3B6dXZxYXhpZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDE4NDEsImV4cCI6MjA5MTA3Nzg0MX0.OnjMEKyVeXQRgOnalz2DArZqyr9ybu0LUhGZw9svJbU');

async function test() {
  const { data, error } = await supabase.from('test_results').select('*').limit(1);
  console.log('Test Results:', data);
}
test();
