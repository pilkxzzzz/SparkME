import { supabase } from './config.js'

// Обробка форми реєстрації
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Паролі не співпадають');
            return;
        }

        try {
            await register(email, password);
        } catch (error) {
            console.error('Помилка реєстрації:', error);
        }
    });
}

// Обробка форми входу
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await login(email, password);
    });
}

// Попередній перегляд фото профілю
const photoInput = document.getElementById('photo');
if (photoInput) {
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Тут можна додати логіку для відображення превью фото
                console.log('Фото завантажено:', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

async function register(email, password) {
    try {
        console.log('Спроба реєстрації:', email);
        
        if (!supabase) {
            throw new Error('Не вдалося підключитися до Supabase');
        }

        // Спробуємо зареєструвати користувача
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password
        });

        console.log('Відповідь від Supabase:', { signUpData, signUpError });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                console.log('Користувач вже зареєстрований, спроба входу...');
                return await login(email, password);
            }
            throw signUpError;
        }

        if (signUpData?.user) {
            console.log('Успішна реєстрація:', signUpData.user);
            
            // Створюємо запис в таблиці profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: signUpData.user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('Помилка створення профілю:', profileError);
                throw profileError;
            }

            // Відразу виконуємо вхід
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                throw signInError;
            }

            if (signInData?.session) {
                console.log('Успішний вхід після реєстрації:', signInData.session);
                window.location.href = 'profile-settings.html';
                return;
            }
        }
        
        throw new Error('Не вдалося створити користувача');
    } catch (error) {
        console.error('Помилка реєстрації:', error);
        alert('Помилка реєстрації: ' + (error.message || 'Перевірте підключення до інтернету'));
    }
}

async function login(email, password) {
    try {
        if (!supabase) {
            throw new Error('Не вдалося підключитися до Supabase');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (data?.session) {
            console.log('Успішний вхід:', data.session);

            // Перевіряємо чи заповнений профіль
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('name, age')
                .eq('id', data.session.user.id)
                .single();

            if (profileError) {
                console.error('Помилка отримання профілю:', profileError);
            }

            // Якщо профіль не заповнений (немає імені або віку), 
            // перенаправляємо на сторінку налаштувань
            if (!profile?.name || !profile?.age) {
                console.log('Профіль не заповнений, перенаправлення на налаштування');
                window.location.href = 'profile-settings.html';
                return;
            }

            // Якщо профіль заповнений, перенаправляємо на головну
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Помилка входу:', error);
        alert('Помилка входу: ' + (error.message || 'Перевірте підключення до інтернету'));
    }
}

async function logout() {
    try {
        if (!supabase) {
            throw new Error('Не вдалося підключитися до Supabase');
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        window.location.href = 'index.html';
    } catch (error) {
        console.error('Помилка виходу:', error);
        alert('Помилка виходу: ' + (error.message || 'Спробуйте ще раз'));
    }
}

// Експортуємо функції
export { login, register, logout };

// Робимо logout доступним глобально
window.logout = logout;

// Перевірка автентифікації при завантаженні сторінки
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        // Якщо користувач не авторизований і це не сторінка логіну/реєстрації
        if (!session?.user && 
            !window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Помилка перевірки автентифікації:', error);
    }
}); 