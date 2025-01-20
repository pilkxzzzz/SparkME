import { supabase } from './config.js'

document.addEventListener('DOMContentLoaded', async () => {
    const profilesContainer = document.getElementById('profilesContainer');
    
    if (!profilesContainer) {
        return; // Виходимо, якщо елемент не знайдено
    }

    // Перевіряємо, чи користувач авторизований
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session?.user) {
        profilesContainer.innerHTML = `
            <div class="auth-prompt">
                <h3>Увійдіть, щоб побачити анкети</h3>
                <p>Для перегляду анкет необхідно увійти в свій акаунт</p>
                <div class="auth-buttons">
                    <a href="login.html" class="btn-primary">Увійти</a>
                    <a href="register.html" class="btn-outline">Зареєструватися</a>
                </div>
            </div>
        `;
    } else {
        try {
            // Отримуємо профілі з бази даних
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .neq('id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!profiles || profiles.length === 0) {
                profilesContainer.innerHTML = `
                    <div class="no-profiles">
                        <h3>Поки що немає анкет</h3>
                        <p>Спробуйте перевірити пізніше</p>
                    </div>
                `;
                return;
            }

            // Відображаємо профілі
            profilesContainer.innerHTML = profiles.map(profile => `
                <div class="profile-card">
                    <img src="${profile.avatar_url || 'default-avatar.png'}" alt="${profile.name}">
                    <h3>${profile.name || 'Без імені'}, ${profile.age || '?'}</h3>
                    <p>${profile.bio || ''}</p>
                    <button onclick="showProfile('${profile.id}')">Переглянути профіль</button>
                </div>
            `).join('');

        } catch (error) {
            console.error('Помилка при завантаженні профілів:', error);
            profilesContainer.innerHTML = `
                <div class="error-message">
                    <h3>Помилка при завантаженні профілів</h3>
                    <p>Спробуйте оновити сторінку</p>
                </div>
            `;
        }
    }
});

// Функція для перегляду профілю
window.showProfile = async (profileId) => {
    window.location.href = `profile.html?id=${profileId}`;
};

// Бургер меню
const burgerMenu = document.querySelector('.burger-menu');
const navLinks = document.querySelector('.nav-links');

burgerMenu.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// Додаткові стилі для активного бургер меню
const styles = `
    .burger-menu.active div:nth-child(1) {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    .burger-menu.active div:nth-child(2) {
        opacity: 0;
    }
    .burger-menu.active div:nth-child(3) {
        transform: rotate(45deg) translate(-5px, -6px);
    }
    .nav-links.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 60px;
        left: 0;
        right: 0;
        background-color: var(--primary-color);
        padding: 1rem;
        animation: slideDown 0.3s ease-out;
    }
    @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Додаємо плавні анімації для карток профілів
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.profile-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(50px)';
    observer.observe(card);
}); 