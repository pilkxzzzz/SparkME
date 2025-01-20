import { supabase } from './config.js'

// Функція для перевірки авторизації
async function checkAuth() {
    try {
        // Спочатку отримуємо сесію
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // Якщо немає сесії
        if (!session) {
            // Якщо це не сторінка логіну/реєстрації
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }

        const user = session.user;
        
        // Отримуємо профіль користувача
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Помилка отримання профілю:', profileError);
            throw profileError;
        }

        // Якщо профіль не знайдено, створюємо новий
        if (!profile) {
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    name: user.email.split('@')[0], // Тимчасове ім'я з email
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) {
                console.error('Помилка створення профілю:', insertError);
                throw insertError;
            }
        }

        const authButtons = document.getElementById('authButtons');
        if (!authButtons) {
            return; // Виходимо, якщо елемент не знайдено
        }

        const displayName = profile?.name || user.email;
        
        authButtons.innerHTML = `
            <a href="profile.html" class="user-name">${displayName}</a>
            <button onclick="window.logout()" class="btn" title="Вийти"><i class="fas fa-sign-out-alt"></i></button>
        `;

        return user;
    } catch (error) {
        console.error('Помилка перевірки авторизації:', error);
        // Якщо це не сторінка логіну/реєстрації, перенаправляємо на логін
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }
}

// Функція для виходу
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Помилка виходу:', error);
    }
}

// Експортуємо функції
window.checkAuth = checkAuth;
window.logout = logout;

// Перевіряємо авторизацію при завантаженні сторінки
document.addEventListener('DOMContentLoaded', checkAuth);