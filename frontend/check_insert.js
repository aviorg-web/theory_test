import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://edcgpqfscpzuvqaxifdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2dwcWZzY3B6dXZxYXhpZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDE4NDEsImV4cCI6MjA5MTA3Nzg0MX0.OnjMEKyVeXQRgOnalz2DArZqyr9ybu0LUhGZw9svJbU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: cls } = await supabase.from('classes').select('*').limit(1);
  if (!cls || cls.length === 0) return console.log('no classes');
  
  const { data, error } = await supabase.from('test_results').insert([
     { student_name: 'Test', student_tz: '123456789', class_id: cls[0].id, score: 30 }
  ]).select();
  
  console.log('Insert Result:', data, 'Error:', error);
}
test();
