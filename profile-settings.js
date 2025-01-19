import { supabase } from './config.js';

async function updateProfile(profileData) {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error('Помилка сесії:', sessionError);
            throw sessionError;
        }
        
        if (!session?.user) {
            throw new Error('Користувач не авторизований');
        }

        // Перевіряємо обов'язкові поля
        if (!profileData.name || !profileData.age) {
            throw new Error('Ім\'я та вік обов\'язкові для заповнення');
        }

        // Збираємо вибрані інтереси
        const selectedInterests = Array.from(document.querySelectorAll('.tag.selected'))
            .map(tag => tag.dataset.interest);

        // Готуємо дані для оновлення
        const updateData = {
            name: profileData.name.trim(),
            age: parseInt(profileData.age),
            gender: profileData.gender,
            city: profileData.city.trim(),
            bio: profileData.bio.trim(),
            telegram: profileData.telegram.trim(),
            instagram: profileData.instagram.trim(),
            facebook: profileData.facebook.trim(),
            interests: selectedInterests,
            updated_at: new Date().toISOString()
        };

        // Оновлюємо профіль
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: session.user.id,
                ...updateData
            })
            .select()
            .single();

        if (error) {
            console.error('Помилка оновлення в базі даних:', error);
            throw error;
        }

        alert('Профіль успішно оновлено!');
        window.location.href = 'profile.html';

    } catch (error) {
        console.error('Помилка оновлення профілю:', error);
        alert('Помилка оновлення профілю: ' + (error.message || 'Невідома помилка'));
    }
}

// Обробка завантаження фото
async function uploadProfilePhoto(file) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Користувач не авторизований');

        const fileExt = file.name.split('.').pop();
        const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Оновлюємо URL фото в профілі
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                avatar_url: filePath
            })
            .eq('id', session.user.id);

        if (updateError) throw updateError;

        // Оновлюємо превью фото
        const preview = document.getElementById('currentPhoto');
        if (preview) {
            preview.src = URL.createObjectURL(file);
        }
    } catch (error) {
        console.error('Помилка завантаження фото:', error);
        alert('Помилка завантаження фото: ' + error.message);
    }
}

// Функція для перевірки/створення профілю
async function ensureProfile(userId) {
    try {
        // Спробуємо отримати профіль
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        // Якщо профіль не існує, створюємо його
        if (!profile) {
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: userId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (insertError) throw insertError;
            return newProfile;
        }

        return profile;
    } catch (error) {
        console.error('Помилка перевірки/створення профілю:', error);
        throw error;
    }
}

// Оновлюємо обробник завантаження сторінки
document.addEventListener('DOMContentLoaded', async () => {
    const profileForm = document.getElementById('profileSettingsForm');
    const photoInput = document.getElementById('photo');
    const tags = document.querySelectorAll('.tag');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            window.location.href = 'login.html';
            return;
        }

        // Перевіряємо/створюємо профіль
        const profile = await ensureProfile(session.user.id);

        if (profile && profileForm) {
            // Заповнюємо форму
            profileForm.name.value = profile.name || '';
            profileForm.age.value = profile.age || '';
            profileForm.gender.value = profile.gender || '';
            profileForm.city.value = profile.city || '';
            profileForm.bio.value = profile.bio || '';
            profileForm.telegram.value = profile.telegram || '';
            profileForm.instagram.value = profile.instagram || '';
            profileForm.facebook.value = profile.facebook || '';

            // Відмічаємо інтереси
            tags.forEach(tag => {
                if (profile.interests && profile.interests.includes(tag.dataset.interest)) {
                    tag.classList.add('selected');
                }
            });

            // Завантажуємо аватар
            const avatar = document.getElementById('currentPhoto');
            if (avatar) {
                if (profile.avatar_url) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('profiles')
                        .getPublicUrl(profile.avatar_url);
                    avatar.src = publicUrl;
                } else {
                    avatar.src = './images/default-avatar.png';
                }
            }
        }
    } catch (error) {
        console.error('Помилка ініціалізації профілю:', error);
        alert('Помилка завантаження профілю. Спробуйте оновити сторінку.');
    }

    // Обробник форми
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const profileData = {
                name: formData.get('name'),
                age: formData.get('age'),
                gender: formData.get('gender'),
                city: formData.get('city'),
                bio: formData.get('bio'),
                telegram: formData.get('telegram'),
                instagram: formData.get('instagram'),
                facebook: formData.get('facebook')
            };
            await updateProfile(profileData);
        });
    }

    // Обробник завантаження фото
    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) throw new Error('Користувач не авторизований');

                    const fileExt = file.name.split('.').pop();
                    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
                    const filePath = `avatars/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('profiles')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ avatar_url: filePath })
                        .eq('id', session.user.id);

                    if (updateError) throw updateError;

                    const avatar = document.getElementById('currentPhoto');
                    if (avatar) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('profiles')
                            .getPublicUrl(filePath);
                        avatar.src = publicUrl;
                    }

                    alert('Фото профілю оновлено!');
                } catch (error) {
                    console.error('Помилка завантаження фото:', error);
                    alert('Помилка завантаження фото: ' + error.message);
                }
            }
        });
    }

    // Обробники тегів
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('selected');
        });
    });
}); 