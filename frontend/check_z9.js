import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://edcgpqfscpzuvqaxifdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2dwcWZzY3B6dXZxYXhpZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDE4NDEsImV4cCI6MjA5MTA3Nzg0MX0.OnjMEKyVeXQRgOnalz2DArZqyr9ybu0LUhGZw9svJbU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: q1 } = await supabase.from('questions').select('*').ilike('question_text', '%z9uUXWecF4%').limit(2);
  console.log('Video Questions:', JSON.stringify(q1, null, 2));
}

test();
