// Ініціалізуємо Supabase
const supabaseUrl = 'https://hqqqneqjqvjaemjusxub.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxcXFuZXFqcXZqYWVtanVzeHViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczMTMzNjQsImV4cCI6MjA1Mjg4OTM2NH0.1uV4_zyh1AouKmEMSqgvUDpQG4RoF_ppSZDel79wsIk';

// Перевіряємо, чи не існує вже клієнт
let supabase;
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
}
supabase = window.supabaseClient;

export { supabase };