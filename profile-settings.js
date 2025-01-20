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

// Функція для стиснення зображення
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Максимальний розмір для фото профілю
                const MAX_SIZE = 800;

                if (width > height && width > MAX_SIZE) {
                    height = Math.round((height * MAX_SIZE) / width);
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width = Math.round((width * MAX_SIZE) / height);
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', 0.8); // Якість 0.8 для оптимального балансу
            };
        };
    });
}

// Оновлена функція завантаження фото
async function uploadProfilePhoto(file) {
    const progressBar = document.querySelector('.progress-bar');
    const progressContainer = document.getElementById('uploadProgress');
    
    try {
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Користувач не авторизований');

        // Стискаємо зображення перед завантаженням
        const compressedFile = await compressImage(file);

        const fileName = `${session.user.id}-${Math.random()}.jpg`;

        // Симулюємо прогрес завантаження
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress <= 90) {
                progressBar.style.width = `${progress}%`;
            }
        }, 100);

        try {
            // Завантажуємо файл
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: true
                });

            clearInterval(progressInterval);
            
            if (uploadError) {
                console.error('Помилка завантаження:', uploadError);
                throw uploadError;
            }

            // Отримуємо публічне URL завантаженого файлу
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Оновлюємо URL фото в профілі
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: fileName
                })
                .eq('id', session.user.id);

            if (updateError) {
                console.error('Помилка оновлення профілю:', updateError);
                throw updateError;
            }

            // Показуємо 100% прогрес
            progressBar.style.width = '100%';
            
            // Оновлюємо аватарку на сторінці
            const avatar = document.getElementById('currentAvatar');
            if (avatar) {
                avatar.src = publicUrl;
            }

            return { fileName, publicUrl };
        } catch (error) {
            console.error('Помилка завантаження фото:', error);
            throw error;
        } finally {
            clearInterval(progressInterval);
        }

        // Ховаємо прогрес бар після успішного завантаження
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 1000);

    } catch (error) {
        console.error('Помилка завантаження фото:', error);
        alert('Помилка завантаження фото: ' + error.message);
        progressContainer.style.display = 'none';
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
                        .from('avatars')
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
                await uploadProfilePhoto(file);
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