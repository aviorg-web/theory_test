import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://edcgpqfscpzuvqaxifdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2dwcWZzY3B6dXZxYXhpZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDE4NDEsImV4cCI6MjA5MTA3Nzg0MX0.OnjMEKyVeXQRgOnalz2DArZqyr9ybu0LUhGZw9svJbU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = 'test_teacher_' + Date.now() + '@example.com';
  const password = 'testpassword123';
  
  // 1. register user
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) { console.error('Auth Error:', authError); return; }
  
  console.log('User created:', authData.user.id);
  
  // 2. Add to teachers table
  const { error: tError } = await supabase.from('teachers').insert([{
    id: authData.user.id,
    email,
    full_name: 'Test Teacher',
    school_symbol_1: '123',
    role: 'TEACHER',
    status: 'approved'
  }]);
  if (tError) { console.error('Teachers Error:', tError); }
  
  // 3. Try to add to classes table
  const { error: cError } = await supabase.from('classes').insert([{
    teacher_id: authData.user.id,
    name: 'Test Class',
    pin_code: '12345'
  }]);
  
  if (cError) {
    console.error('Classes Error:', cError);
  } else {
    console.log('Class created successfully');
  }
}

test();
