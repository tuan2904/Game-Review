-- GameReview — seed data mẫu để test UI/API
-- Chạy: docker compose exec -T db psql -U tuanhd -d gamereview < seed_data.sql
-- (chạy lại nhiều lần được: user trùng email sẽ bị bỏ qua; muốn reset role/mật khẩu
--  của tài khoản test thì chạy: docker compose exec backend python manage.py seed_test_accounts)
--
-- ===================== TÀI KHOẢN TEST (mật khẩu thật để đăng nhập) =====================
--  EMAIL                          | ROLE                       | MẬT KHẨU
--  superadmin@gamereview.test     | Superadmin                 | Test@12345
--  admin1@gamereview.test         | Admin                      | Test@12345
--  admin2@gamereview.test         | Admin                      | Test@12345
--  user1@gamereview.test          | User                       | Test@12345
--  user2@gamereview.test          | User                       | Test@12345
--  user3@gamereview.test          | User                       | Test@12345
--  locked@gamereview.test         | User bị khóa (không login) | Test@12345
--  admin@gamereview.dev           | Admin                      | Passw0rd!123
--  alice@example.com              | User                       | Passw0rd!123
--  bob@example.com                | User                       | Passw0rd!123
--  carol@example.com              | User                       | Passw0rd!123
-- (cột password trong bảng bên dưới là hash PBKDF2 nên không đọc được — mật khẩu thật nằm ở đây)
-- ======================================================================================

BEGIN;

-- ========== USERS ==========
INSERT INTO accounts_user (password, first_name, last_name, is_superuser, is_staff, is_active, date_joined, email, created_at, updated_at)
VALUES
  -- superadmin@gamereview.test | SUPERADMIN (is_superuser + is_staff, vào được cả Django /admin/) | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'Super', 'Admin', true, true, true, now(), 'superadmin@gamereview.test', now(), now()),
  -- admin1@gamereview.test | ADMIN (is_staff) | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'Admin', 'One', false, true, true, now(), 'admin1@gamereview.test', now(), now()),
  -- admin2@gamereview.test | ADMIN (is_staff) | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'Admin', 'Two', false, true, true, now(), 'admin2@gamereview.test', now(), now()),
  -- user1@gamereview.test | USER thường | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'User', 'One', false, false, true, now(), 'user1@gamereview.test', now(), now()),
  -- user2@gamereview.test | USER thường | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'User', 'Two', false, false, true, now(), 'user2@gamereview.test', now(), now()),
  -- user3@gamereview.test | USER thường | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'User', 'Three', false, false, true, now(), 'user3@gamereview.test', now(), now()),
  -- locked@gamereview.test | USER BỊ KHÓA (is_active=false -> không đăng nhập được) | password: Test@12345
  ('pbkdf2_sha256$1500000$mZJjjMdCVqhqR2L5uJVbVV$WGw/jNUMqRY55lboKO6GcARu1aDJ1976RUfiryBKXZE=', 'Locked', 'User', false, false, false, now(), 'locked@gamereview.test', now(), now()),
  -- admin@gamereview.dev | ADMIN (is_staff) | password: Passw0rd!123
  ('pbkdf2_sha256$1500000$qwrhONUH1ZRtwfB0Wwn2RX$RiSZYMbHHIBeBCV018GJ+CV1hsZzScG8np88kYsEq38=', 'Admin', 'GameReview', false, true, true, now(), 'admin@gamereview.dev', now(), now()),
  -- alice@example.com | USER thường | password: Passw0rd!123
  ('pbkdf2_sha256$1500000$qwrhONUH1ZRtwfB0Wwn2RX$RiSZYMbHHIBeBCV018GJ+CV1hsZzScG8np88kYsEq38=', 'Alice', 'Nguyen', false, false, true, now(), 'alice@example.com', now(), now()),
  -- bob@example.com | USER thường | password: Passw0rd!123
  ('pbkdf2_sha256$1500000$qwrhONUH1ZRtwfB0Wwn2RX$RiSZYMbHHIBeBCV018GJ+CV1hsZzScG8np88kYsEq38=', 'Bob', 'Tran', false, false, true, now(), 'bob@example.com', now(), now()),
  -- carol@example.com | USER thường | password: Passw0rd!123
  ('pbkdf2_sha256$1500000$qwrhONUH1ZRtwfB0Wwn2RX$RiSZYMbHHIBeBCV018GJ+CV1hsZzScG8np88kYsEq38=', 'Carol', 'Le', false, false, true, now(), 'carol@example.com', now(), now())
ON CONFLICT (email) DO NOTHING;

-- ========== CATEGORIES ==========
INSERT INTO games_category (name, slug, created_at, updated_at) VALUES
  ('Action',      'action',      now(), now()),
  ('RPG',         'rpg',         now(), now()),
  ('Indie',       'indie',       now(), now()),
  ('Strategy',    'strategy',    now(), now()),
  ('Adventure',   'adventure',   now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ========== GAMES ==========
INSERT INTO games_game (name, slug, description, developer, publisher, release_date, cover_image, status, category_id, created_at, updated_at)
VALUES
  ('Elden Ring', 'elden-ring', 'Open-world action RPG.FromSoftware hợp tác với George R.R. Martin. Thế giới Lands Between rộng lớn, boss khó nhằn và tự do khám phá.',
   'FromSoftware', 'Bandai Namco', '2022-02-25', 'http://localhost:5173/covers/elden-ring.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='rpg'), now(), now()),

  ('Hollow Knight', 'hollow-knight', 'Metroidvania indie lấy bối cảnh vương quốc côn trùng Hallownest. Đồ họa hand-drawn, chiến đấu tight, khám phá bí ẩn.',
   'Team Cherry', 'Team Cherry', '2017-02-24', 'http://localhost:5173/covers/hollow-knight.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='indie'), now(), now()),

  ('Stardew Valley', 'stardew-valley', 'Farm-sim thư giãn: trồng trọt, khai thác mỏ, kết bạn, cưới spouse. Một người làm gần như toàn bộ game.',
   'ConcernedApe', 'ConcernedApe', '2016-02-26', 'http://localhost:5173/covers/stardew-valley.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='indie'), now(), now()),

  ('Cyberpunk 2077', 'cyberpunk-2077', 'RPG thế giới mở Cyberpunk tại Night City. Ban đầu nhiều lỗi, sau được cập nhật lớn 2.0 và Phantom Liberty.',
   'CD Projekt Red', 'CD Projekt', '2020-12-10', 'http://localhost:5173/covers/cyberpunk-2077.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='rpg'), now(), now()),

  ('Hades', 'hades', 'Roguelike thần thoại Hy Lạp. Chết -> quay lại Inferno, mạnh dần lên. Chiến đấu đỉnh cao, cốt truyện kể dần qua mỗi lượt chạy.',
   'Supergiant Games', 'Supergiant Games', '2020-09-17', 'http://localhost:5173/covers/hades.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='action'), now(), now()),

  ('Portal 2', 'portal-2', 'Puzzle FPS huyền thoại. Dùng khẩu súng portal giải câu đố, có chế độ co-op 2 người.',
   'Valve', 'Valve', '2011-04-19', 'http://localhost:5173/covers/portal-2.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='adventure'), now(), now()),

  ('Celeste', 'celeste', 'Platformer khó nhưng công bằng. Leo núi, vượt qua nội tâm nhân vật. Assist mode hỗ trợ game thủ mọi trình độ.',
   'Maddy Makes Games', 'Maddy Makes Games', '2018-01-25', 'http://localhost:5173/covers/celeste.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='indie'), now(), now()),

  ('Factorio', 'factorio', 'Xây nhà máy tự động hoá quy mô khổng lồ. Research, mở rộng, phòng thủ khỏi quái. Nghiện cực mạnh.',
   'Wube Software', 'Wube Software', '2020-08-14', 'http://localhost:5173/covers/factorio.jpg', 'ACTIVE',
   (SELECT id FROM games_category WHERE slug='strategy'), now(), now()),

  ('Disco Elysium', 'disco-elysium', 'RPG trinh thám không chiến đấu, toàn bộ gameplay là đối thoại và Rolleplay nội tâm. Director''s Cut thêm voice và võ thuật.',
   'ZA/UM', 'ZA/UM', '2019-10-15', 'http://localhost:5173/covers/disco-elysium.jpg', 'INACTIVE',
   (SELECT id FROM games_category WHERE slug='rpg'), now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ========== REVIEWS ==========
-- Mỗi user chỉ 1 review / 1 game (unique constraint user_id+game_id)
INSERT INTO reviews_review (rating, content, game_id, user_id, created_at, updated_at)
VALUES
  (5, 'Đỉnh cao của thể loại Souls-like. Map liên tục, bí ẩn, boss unforgettable. Đồ họa và nhạc tuyệt vời.',
   (SELECT id FROM games_game WHERE slug='elden-ring'),
   (SELECT id FROM accounts_user WHERE email='alice@example.com'), now(), now()),
  (4, 'Rất hay nhưng hơi khó với người mới. Cần kiên nhẫn, nhưng phần thưởng khi hạ boss là cực phẩm.',
   (SELECT id FROM games_game WHERE slug='elden-ring'),
   (SELECT id FROM accounts_user WHERE email='bob@example.com'), now(), now()),

  (5, 'Metroidvania hay nhất mình từng chơi. Không cần map, exploration tự nhiên, boss Charm pilled.',
   (SELECT id FROM games_game WHERE slug='hollow-knight'),
   (SELECT id FROM accounts_user WHERE email='bob@example.com'), now(), now()),
  (5, 'Đẹp, khó, đáng. Silksong ra mau thôi!',
   (SELECT id FROM games_game WHERE slug='hollow-knight'),
   (SELECT id FROM accounts_user WHERE email='carol@example.com'), now(), now()),

  (5, 'Game thư giãn số 1. 10h tối ngồi chơi, 4h sáng mới ngẩng đầu. spouse pixel đáng yêu cực.',
   (SELECT id FROM games_game WHERE slug='stardew-valley'),
   (SELECT id FROM accounts_user WHERE email='carol@example.com'), now(), now()),

  (4, 'Cốt truyện và thế giới Night City đỉnh, nhưng mở máy yếu thì méo chơi được. Sau patch 2.0 thì rất ổn.',
   (SELECT id FROM games_game WHERE slug='cyberpunk-2077'),
   (SELECT id FROM accounts_user WHERE email='alice@example.com'), now(), now()),

  (5, 'Roguelike hay nhất 2020. Cốt truyện kể dần qua mỗi lần chết, gameplay tight, art style đỉnh.',
   (SELECT id FROM games_game WHERE slug='hades'),
   (SELECT id FROM accounts_user WHERE email='alice@example.com'), now(), now()),
  (5, 'Zagreus là con trai Hades, fight me. soundtrack của Darren Korb xứng đáng giải thưởng.',
   (SELECT id FROM games_game WHERE slug='hades'),
   (SELECT id FROM accounts_user WHERE email='user1@gamereview.test'), now(), now()),

  (5, 'Puzzle design hoàn hảo. Wheatley là nhân vật hài hước nhất lịch sử game.',
   (SELECT id FROM games_game WHERE slug='portal-2'),
   (SELECT id FROM accounts_user WHERE email='bob@example.com'), now(), now()),

  (4, 'Khó nhưng công bằng. Assist mode là minh chứng game dễ tiếp cận không phải game dễ.',
   (SELECT id FROM games_game WHERE slug='celeste'),
   (SELECT id FROM accounts_user WHERE email='carol@example.com'), now(), now()),

  (5, 'Nghiện. Xây nhà máy 2000h rồi vẫn chưa thoả. Factorio is factorio.',
   (SELECT id FROM games_game WHERE slug='factorio'),
   (SELECT id FROM accounts_user WHERE email='user1@gamereview.test'), now(), now());

-- ========== COMMENTS ==========
INSERT INTO comments_comment (content, review_id, user_id, is_hidden, created_at, updated_at)
VALUES
  ('Đồng ý! Malenia là boss khó nhất mình từng gặp.', 
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='elden-ring' AND u.email='alice@example.com'),
   (SELECT id FROM accounts_user WHERE email='bob@example.com'), false, now(), now()),
  ('Map design của FromSoftware không có gì chê được.',
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='elden-ring' AND u.email='alice@example.com'),
   (SELECT id FROM accounts_user WHERE email='carol@example.com'), false, now(), now()),

  ('Silksong delayed lần nữa rồi huhu.',
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='hollow-knight' AND u.email='bob@example.com'),
   (SELECT id FROM accounts_user WHERE email='alice@example.com'), false, now(), now()),

  ('Marry Sebastian là quyết định đúng đắn nhất mình làm trong game này.',
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='stardew-valley' AND u.email='carol@example.com'),
   (SELECT id FROM accounts_user WHERE email='user1@gamereview.test'), false, now(), now()),

  ('Soundtrack nghe hoài không chán, đặc biệt là We All Become.',
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='hades' AND u.email='alice@example.com'),
   (SELECT id FROM accounts_user WHERE email='bob@example.com'), false, now(), now()),

  ('Portal 2 co-op với bạn là kỷ niệm khó quên.',
   (SELECT r.id FROM reviews_review r JOIN games_game g ON r.game_id=g.id JOIN accounts_user u ON r.user_id=u.id WHERE g.slug='portal-2' AND u.email='bob@example.com'),
   (SELECT id FROM accounts_user WHERE email='carol@example.com'), false, now(), now());

-- ========== FAVORITES ==========
INSERT INTO favorites_favorite (user_id, game_id, created_at) VALUES
  ((SELECT id FROM accounts_user WHERE email='alice@example.com'),    (SELECT id FROM games_game WHERE slug='hollow-knight'),   now()),
  ((SELECT id FROM accounts_user WHERE email='alice@example.com'),    (SELECT id FROM games_game WHERE slug='hades'),          now()),
  ((SELECT id FROM accounts_user WHERE email='bob@example.com'),      (SELECT id FROM games_game WHERE slug='elden-ring'),     now()),
  ((SELECT id FROM accounts_user WHERE email='bob@example.com'),      (SELECT id FROM games_game WHERE slug='portal-2'),       now()),
  ((SELECT id FROM accounts_user WHERE email='carol@example.com'),    (SELECT id FROM games_game WHERE slug='stardew-valley'), now()),
  ((SELECT id FROM accounts_user WHERE email='carol@example.com'),    (SELECT id FROM games_game WHERE slug='celeste'),        now()),
  ((SELECT id FROM accounts_user WHERE email='user1@gamereview.test'),  (SELECT id FROM games_game WHERE slug='hades'),          now()),
  ((SELECT id FROM accounts_user WHERE email='user1@gamereview.test'),  (SELECT id FROM games_game WHERE slug='factorio'),       now()),
  ((SELECT id FROM accounts_user WHERE email='user1@gamereview.test'),  (SELECT id FROM games_game WHERE slug='elden-ring'),     now())
ON CONFLICT DO NOTHING;

COMMIT;

-- ========== SUMMARY ==========
SELECT 'users' AS tbl, count(*) FROM accounts_user
UNION ALL SELECT 'categories', count(*) FROM games_category
UNION ALL SELECT 'games', count(*) FROM games_game
UNION ALL SELECT 'reviews', count(*) FROM reviews_review
UNION ALL SELECT 'comments', count(*) FROM comments_comment
UNION ALL SELECT 'favorites', count(*) FROM favorites_favorite;
