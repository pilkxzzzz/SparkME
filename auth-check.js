import { supabase } from './config.js'

// Функція для перевірки авторизації
async function checkAuth() {
    const authButtons = document.getElementById('authButtons');
    if (!authButtons) {
        return; // Виходимо, якщо елемент не знайдено
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Помилка перевірки сесії:', error);
            return;
        }
        
        if (session?.user) {
            // Отримуємо профіль користувача
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle(); // Використовуємо maybeSingle замість single

            if (profileError) {
                console.error('Помилка отримання профілю:', profileError);
            }

            const displayName = profile?.name || session.user.email;
            
            authButtons.innerHTML = `
                <a href="profile.html" class="user-name">${displayName}</a>
                <button onclick="window.logout()" class="btn" title="Вийти"><i class="fas fa-sign-out-alt"></i></button>
            `;
        } else {
            // Приховуємо кнопки авторизації
            authButtons.style.display = 'none';
        }
    } catch (error) {
        console.error('Помилка перевірки автентифікації:', error);
    }
}

// Функція для виходу з системи
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Помилка виходу:', error);
            return;
        }
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Помилка виходу:', error);
    }
}

// Робимо функцію logout доступною глобально
window.logout = logout;

// Перевіряємо авторизацію при завантаженні сторінки
document.addEventListener('DOMContentLoaded', checkAuth);