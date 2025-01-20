-- Створюємо таблицю profiles
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone,
    name text,
    age integer,
    gender text check (gender in ('male', 'female')),
    city text,
    bio text,
    avatar_url text,
    telegram text,
    instagram text,
    facebook text,
    interests text[],
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Включаємо Row Level Security
alter table public.profiles enable row level security;

-- Політики безпеки для profiles
create policy "Profiles are viewable by everyone"
    on profiles for select
    using ( true );

create policy "Users can insert their own profile"
    on profiles for insert
    with check ( auth.uid() = id );

create policy "Users can update own profile"
    on profiles for update
    using ( auth.uid() = id );

-- Створюємо таблицю для повідомлень
create table public.messages (
    id uuid default uuid_generate_v4() primary key,
    sender_id uuid references auth.users not null,
    receiver_id uuid references auth.users not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    read_at timestamp with time zone
);

-- Включаємо RLS для messages
alter table public.messages enable row level security;

-- Політики безпеки для messages
create policy "Users can view their own messages"
    on messages for select
    using (
        auth.uid() = sender_id or
        auth.uid() = receiver_id
    );

create policy "Users can send messages"
    on messages for insert
    with check ( auth.uid() = sender_id );

-- Створюємо таблицю для галереї фотографій
create table public.gallery (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    image_url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Включаємо RLS для gallery
alter table public.gallery enable row level security;

-- Політики безпеки для gallery
create policy "Images are viewable by everyone"
    on gallery for select
    using ( true );

create policy "Users can upload their own images"
    on gallery for insert
    with check ( auth.uid() = user_id );

create policy "Users can delete their own images"
    on gallery for delete
    using ( auth.uid() = user_id );

-- Створюємо таблицю для лайків/матчів
create table public.matches (
    id uuid default uuid_generate_v4() primary key,
    user1_id uuid references auth.users not null,
    user2_id uuid references auth.users not null,
    user1_liked boolean default false,
    user2_liked boolean default false,
    matched_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(user1_id, user2_id)
);

-- Включаємо RLS для matches
alter table public.matches enable row level security;

-- Політики безпеки для matches
create policy "Users can view their own matches"
    on matches for select
    using (
        auth.uid() = user1_id or
        auth.uid() = user2_id
    );

create policy "Users can create matches"
    on matches for insert
    with check (
        auth.uid() = user1_id or
        auth.uid() = user2_id
    );

create policy "Users can update their own matches"
    on matches for update
    using (
        auth.uid() = user1_id or
        auth.uid() = user2_id
    );

-- Функція для оновлення matched_at коли обидва користувачі лайкнули один одного
create or replace function public.handle_match()
returns trigger
language plpgsql
security definer
as $$
begin
    if NEW.user1_liked = true and NEW.user2_liked = true then
        NEW.matched_at = now();
    end if;
    return NEW;
end;
$$;

-- Тригер для виклику функції handle_match
create trigger on_match
    before update on public.matches
    for each row
    execute function public.handle_match();

-- Індекси для оптимізації
create index if not exists profiles_name_idx on profiles (name);
create index if not exists profiles_age_idx on profiles (age);
create index if not exists profiles_city_idx on profiles (city);
create index if not exists messages_sender_receiver_idx on messages (sender_id, receiver_id);
create index if not exists matches_users_idx on matches (user1_id, user2_id); 