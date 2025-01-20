import { supabase } from './config.js';

async function loadProfile() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            window.location.href = 'login.html';
            return;
        }

        // Отримуємо профіль користувача
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error) {
            console.error('Помилка завантаження профілю:', error);
            return;
        }

        // Оновлюємо інформацію на сторінці
        const nameElement = document.getElementById('profileName');
        const ageElement = document.getElementById('profileAge');
        const cityElement = document.getElementById('profileCity');
        const bioElement = document.getElementById('profileBio');
        const interestsElement = document.getElementById('profileInterests');
        const avatar = document.getElementById('profilePhoto');
        const socialLinks = document.getElementById('profileContacts');
        const galleryElement = document.getElementById('profileGallery');

        // Встановлюємо аватарку за замовчуванням
        if (avatar) {
            if (profile?.avatar_url) {
                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(profile.avatar_url);
                avatar.src = publicUrl;
            } else {
                avatar.src = '/images/default-avatar.png';
            }
        }

        if (profile) {
            // Оновлюємо основну інформацію
            if (nameElement) nameElement.textContent = profile.name || session.user.email;
            if (ageElement) ageElement.textContent = profile.age ? `${profile.age} років` : '';
            if (cityElement) cityElement.textContent = profile.city || '';
            if (bioElement) bioElement.textContent = profile.bio || 'Розкажіть про себе...';

            // Інтереси
            if (interestsElement) {
                if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0) {
                    interestsElement.innerHTML = profile.interests.map(interest => 
                        `<span class="interest-badge">${interest}</span>`
                    ).join('');
                } else {
                    interestsElement.innerHTML = '<p>Додайте свої інтереси в налаштуваннях профілю</p>';
                }
            }

            // Соціальні мережі
            if (socialLinks) {
                let socialHtml = '';
                if (profile.telegram) {
                    socialHtml += `
                        <a href="https://t.me/${profile.telegram}" target="_blank" class="social-link">
                            <i class="fab fa-telegram"></i>
                            <span>Telegram</span>
                        </a>`;
                }
                if (profile.instagram) {
                    socialHtml += `
                        <a href="https://instagram.com/${profile.instagram}" target="_blank" class="social-link">
                            <i class="fab fa-instagram"></i>
                            <span>Instagram</span>
                        </a>`;
                }
                if (profile.facebook) {
                    socialHtml += `
                        <a href="${profile.facebook}" target="_blank" class="social-link">
                            <i class="fab fa-facebook"></i>
                            <span>Facebook</span>
                        </a>`;
                }
                socialLinks.innerHTML = socialHtml || '<p>Додайте свої соціальні мережі в налаштуваннях профілю</p>';
            }

            // Галерея
            if (galleryElement) {
                galleryElement.innerHTML = '<p>Додайте фото в галерею</p>';
            }
        } else {
            // Якщо профіль не знайдено, показуємо базову інформацію
            if (nameElement) nameElement.textContent = session.user.email;
            if (ageElement) ageElement.textContent = '';
            if (cityElement) cityElement.textContent = '';
            if (bioElement) bioElement.textContent = 'Заповніть інформацію про себе в налаштуваннях профілю';
            if (interestsElement) interestsElement.innerHTML = '<p>Додайте свої інтереси в налаштуваннях профілю</p>';
            if (socialLinks) socialLinks.innerHTML = '<p>Додайте свої соціальні мережі в налаштуваннях профілю</p>';
            if (galleryElement) galleryElement.innerHTML = '<p>Додайте фото в галерею</p>';
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
}

// Завантажуємо профіль при завантаженні сторінки
document.addEventListener('DOMContentLoaded', loadProfile); 