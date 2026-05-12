import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://edcgpqfscpzuvqaxifdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2dwcWZzY3B6dXZxYXhpZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDE4NDEsImV4cCI6MjA5MTA3Nzg0MX0.OnjMEKyVeXQRgOnalz2DArZqyr9ybu0LUhGZw9svJbU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('teachers').select('*').limit(1);
  console.log('Teachers Data:', data);
  const { data: cData, error: cError } = await supabase.from('classes').insert([{
    teacher_id: data[0].id,
    class_name: 'Test Class',
    pin_code: '12345'
  }]);
  console.log('Insert Class Error:', cError);
}
test();
