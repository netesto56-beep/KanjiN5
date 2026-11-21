-- ============================================================
-- Seed таблицы public.kanji данными из kanji.json
-- Сгенерировано scripts/generate-seed-sql.mjs — не редактируйте вручную.
-- Запустите этот файл в Supabase → SQL Editor.
-- ============================================================

begin;

-- 1. Кандзи (идемпотентно: повторный запуск обновит существующие строки)
insert into public.kanji (kanji, meaning, onyomi, kunyomi, examples)
values
  ('学', 'учёба, обучение', '["ガク"]'::jsonb, '["まなぶ"]'::jsonb, '[{"word":"学生","reading":"がくせい","meaning":"студент"}]'::jsonb),
  ('日', 'солнце, день', '["ニチ","ジツ"]'::jsonb, '["ひ","か"]'::jsonb, '[{"word":"毎日","reading":"まいにち","meaning":"каждый день"},{"word":"日曜日","reading":"にちようび","meaning":"воскресенье"},{"word":"日本","reading":"にほん","meaning":"Япония"}]'::jsonb),
  ('月', 'луна, месяц', '["ゲツ","ガツ"]'::jsonb, '["つき"]'::jsonb, '[{"word":"月曜日","reading":"げつようび","meaning":"понедельник"},{"word":"月刊","reading":"げっかん","meaning":"ежемесячное издание"}]'::jsonb),
  ('火', 'огонь', '["カ"]'::jsonb, '["ひ"]'::jsonb, '[{"word":"火曜日","reading":"かようび","meaning":"вторник"},{"word":"火山","reading":"かざん","meaning":"вулкан"}]'::jsonb),
  ('水', 'вода', '["スイ"]'::jsonb, '["みず"]'::jsonb, '[{"word":"水曜日","reading":"すいようび","meaning":"среда"},{"word":"水道","reading":"すいどう","meaning":"водопровод"}]'::jsonb),
  ('木', 'дерево', '["モク","ボク"]'::jsonb, '["き","こ"]'::jsonb, '[{"word":"木曜日","reading":"もくようび","meaning":"четверг"},{"word":"木材","reading":"もくざい","meaning":"древесина"}]'::jsonb),
  ('金', 'золото, металл, деньги', '["キン","コン"]'::jsonb, '["かね","かな"]'::jsonb, '[{"word":"お金","reading":"おかね","meaning":"деньги"},{"word":"金曜日","reading":"きんようび","meaning":"пятница"},{"word":"金属","reading":"きんぞく","meaning":"металл"}]'::jsonb),
  ('人', 'человек', '["ジン","ニン"]'::jsonb, '["ひと"]'::jsonb, '[{"word":"日本人","reading":"にほんじん","meaning":"японец"},{"word":"人","reading":"ひと","meaning":"человек"},{"word":"人口","reading":"じんこう","meaning":"население"}]'::jsonb),
  ('山', 'гора', '["サン"]'::jsonb, '["やま"]'::jsonb, '[{"word":"富士山","reading":"ふじさん","meaning":"Фудзи"},{"word":"山","reading":"やま","meaning":"гора"},{"word":"山道","reading":"やまみち","meaning":"горная тропа"}]'::jsonb),
  ('川', 'река', '["セン"]'::jsonb, '["かわ"]'::jsonb, '[{"word":"小川","reading":"おがわ","meaning":"ручей"},{"word":"川岸","reading":"かわぎし","meaning":"берег реки"},{"word":"川","reading":"かわ","meaning":"река"}]'::jsonb),
  ('土', 'земля, почва', '["ド","ト"]'::jsonb, '["つち"]'::jsonb, '[{"word":"土曜日","reading":"どようび","meaning":"суббота"},{"word":"土","reading":"つち","meaning":"земля"},{"word":"土地","reading":"とち","meaning":"земля, участок"}]'::jsonb),
  ('年', 'год', '["ネン"]'::jsonb, '["とし"]'::jsonb, '[{"word":"今年","reading":"ことし","meaning":"этот год"},{"word":"去年","reading":"きょねん","meaning":"прошлый год"},{"word":"年","reading":"とし","meaning":"год"}]'::jsonb),
  ('時', 'время, час', '["ジ"]'::jsonb, '["とき"]'::jsonb, '[{"word":"時間","reading":"じかん","meaning":"время"},{"word":"時々","reading":"ときどき","meaning":"иногда"},{"word":"時","reading":"とき","meaning":"время"}]'::jsonb),
  ('行', 'идти, ехать, проводить', '["コウ","ギョウ"]'::jsonb, '["い","ゆ","おこな"]'::jsonb, '[{"word":"行く","reading":"いく","meaning":"идти"},{"word":"銀行","reading":"ぎんこう","meaning":"банк"},{"word":"旅行","reading":"りょこう","meaning":"путешествие"}]'::jsonb),
  ('見', 'видеть, смотреть', '["ケン"]'::jsonb, '["み"]'::jsonb, '[{"word":"見る","reading":"みる","meaning":"смотреть"},{"word":"見学","reading":"けんがく","meaning":"экскурсия"},{"word":"花見","reading":"はなみ","meaning":"любование цветами"}]'::jsonb),
  ('食', 'есть, пища', '["ショク"]'::jsonb, '["た","く","は"]'::jsonb, '[{"word":"食べる","reading":"たべる","meaning":"есть"},{"word":"食堂","reading":"しょくどう","meaning":"столовая"},{"word":"食事","reading":"しょくじ","meaning":"приём пищи"}]'::jsonb),
  ('大', 'большой, крупный', '["ダイ","タイ"]'::jsonb, '["おお"]'::jsonb, '[{"word":"大きい","reading":"おおきい","meaning":"большой"},{"word":"大学","reading":"だいがく","meaning":"университет"},{"word":"大人","reading":"おとな","meaning":"взрослый"}]'::jsonb),
  ('小', 'маленький, мелкий', '["ショウ"]'::jsonb, '["ちい","こ","お"]'::jsonb, '[{"word":"小さい","reading":"ちいさい","meaning":"маленький"},{"word":"小学校","reading":"しょうがっこう","meaning":"начальная школа"},{"word":"小鳥","reading":"ことり","meaning":"птичка"}]'::jsonb),
  ('中', 'середина, внутри, средний', '["チュウ"]'::jsonb, '["なか"]'::jsonb, '[{"word":"中学校","reading":"ちゅうがっこう","meaning":"средняя школа"},{"word":"中","reading":"なか","meaning":"внутри"},{"word":"途中","reading":"とちゅう","meaning":"по пути"}]'::jsonb),
  ('上', 'верх, верхний, подниматься', '["ジョウ"]'::jsonb, '["うえ","あ","のぼ"]'::jsonb, '[{"word":"上手","reading":"じょうず","meaning":"умелый"},{"word":"上","reading":"うえ","meaning":"верх"},{"word":"上着","reading":"うわぎ","meaning":"куртка"}]'::jsonb),
  ('下', 'низ, нижний, спускаться', '["カ","ゲ"]'::jsonb, '["した","さ","くだ","お"]'::jsonb, '[{"word":"地下鉄","reading":"ちかてつ","meaning":"метро"},{"word":"下","reading":"した","meaning":"низ"},{"word":"下手","reading":"へた","meaning":"неумелый"}]'::jsonb),
  ('出', 'выходить, вынимать', '["シュツ"]'::jsonb, '["で","だ"]'::jsonb, '[{"word":"出口","reading":"でぐち","meaning":"выход"},{"word":"出る","reading":"でる","meaning":"выходить"},{"word":"出席","reading":"しゅっせき","meaning":"посещаемость"}]'::jsonb),
  ('入', 'входить, впускать', '["ニュウ"]'::jsonb, '["はい","い"]'::jsonb, '[{"word":"入口","reading":"いりぐち","meaning":"вход"},{"word":"入る","reading":"はいる","meaning":"входить"},{"word":"入学","reading":"にゅうがく","meaning":"поступление в школу"}]'::jsonb),
  ('本', 'книга, основа, настоящий', '["ホン"]'::jsonb, '["もと"]'::jsonb, '[{"word":"日本","reading":"にほん","meaning":"Япония"},{"word":"本当","reading":"ほんとう","meaning":"правда"},{"word":"本","reading":"ほん","meaning":"книга"}]'::jsonb),
  ('語', 'язык, слово, рассказывать', '["ゴ"]'::jsonb, '["かた"]'::jsonb, '[{"word":"日本語","reading":"にほんご","meaning":"японский язык"},{"word":"英語","reading":"えいご","meaning":"английский язык"},{"word":"物語","reading":"ものがたり","meaning":"повесть, история"}]'::jsonb),
  ('国', 'страна, государство', '["コク"]'::jsonb, '["くに"]'::jsonb, '[{"word":"外国","reading":"がいこく","meaning":"зарубежье, заграница"},{"word":"国","reading":"くに","meaning":"страна"},{"word":"中国","reading":"ちゅうごく","meaning":"Китай"}]'::jsonb),
  ('右', 'правый, справа', '["ウ","ユウ"]'::jsonb, '["みぎ"]'::jsonb, '[{"word":"右手","reading":"みぎて","meaning":"правая рука"},{"word":"右側","reading":"みぎがわ","meaning":"правая сторона"},{"word":"右","reading":"みぎ","meaning":"правая сторона"}]'::jsonb),
  ('左', 'левый, слева', '["サ"]'::jsonb, '["ひだり"]'::jsonb, '[{"word":"左手","reading":"ひだりて","meaning":"левая рука"},{"word":"左側","reading":"ひだりがわ","meaning":"левая сторона"},{"word":"左","reading":"ひだり","meaning":"левая сторона"}]'::jsonb),
  ('前', 'перед, до, раньше', '["ゼン"]'::jsonb, '["まえ"]'::jsonb, '[{"word":"名前","reading":"なまえ","meaning":"имя"},{"word":"前","reading":"まえ","meaning":"перед"},{"word":"午前","reading":"ごぜん","meaning":"до полудня"}]'::jsonb),
  ('後', 'после, сзади, позже', '["ゴ","コウ"]'::jsonb, '["あと","うし","のち"]'::jsonb, '[{"word":"後ろ","reading":"うしろ","meaning":"сзади"},{"word":"午後","reading":"ごご","meaning":"после полудня"},{"word":"後で","reading":"あとで","meaning":"позже"}]'::jsonb),
  ('外', 'снаружи, внешний, кроме', '["ガイ","ゲ"]'::jsonb, '["そと","ほか","はず"]'::jsonb, '[{"word":"外国","reading":"がいこく","meaning":"заграница"},{"word":"外","reading":"そと","meaning":"снаружи"},{"word":"海外","reading":"かいがい","meaning":"за рубежом"}]'::jsonb),
  ('間', 'промежуток, между, пространство', '["カン","ケン"]'::jsonb, '["あいだ","ま"]'::jsonb, '[{"word":"期間","reading":"きかん","meaning":"период"},{"word":"間","reading":"あいだ","meaning":"между"},{"word":"人間","reading":"にんげん","meaning":"человек"}]'::jsonb),
  ('家', 'дом, семья, специалист', '["カ","ケ"]'::jsonb, '["いえ","や","うち"]'::jsonb, '[{"word":"家族","reading":"かぞく","meaning":"семья"},{"word":"家","reading":"いえ","meaning":"дом"},{"word":"作家","reading":"さっか","meaning":"писатель"}]'::jsonb),
  ('女', 'женщина, женский', '["ジョ","ニョ"]'::jsonb, '["おんな","め"]'::jsonb, '[{"word":"女性","reading":"じょせい","meaning":"женщина"},{"word":"彼女","reading":"かのじょ","meaning":"она, девушка"},{"word":"女","reading":"おんな","meaning":"женщина"}]'::jsonb),
  ('男', 'мужчина, мужской', '["ダン","ナン"]'::jsonb, '["おとこ"]'::jsonb, '[{"word":"男性","reading":"だんせい","meaning":"мужчина"},{"word":"男の子","reading":"おとこのこ","meaning":"мальчик"},{"word":"男","reading":"おとこ","meaning":"мужчина"}]'::jsonb),
  ('子', 'ребёнок, дитя', '["シ","ス"]'::jsonb, '["こ"]'::jsonb, '[{"word":"子供","reading":"こども","meaning":"ребёнок"},{"word":"女の子","reading":"おんなのこ","meaning":"девочка"},{"word":"電子","reading":"でんし","meaning":"электрон, электронный"}]'::jsonb)
on conflict (kanji) do update
  set meaning  = excluded.meaning,
      onyomi   = excluded.onyomi,
      kunyomi  = excluded.kunyomi,
      examples = excluded.examples;

-- 2. Справочные данные должны читаться всеми пользователями приложения
alter table public.kanji enable row level security;

drop policy if exists "Anyone can read kanji" on public.kanji;
drop policy if exists "Authenticated can read kanji" on public.kanji;

create policy "Anyone can read kanji" on public.kanji
  for select using (true);

-- 3. Права для ролей Supabase API (RLS сама по себе не выдаёт доступ к таблицам)
grant usage on schema public to anon, authenticated;
grant select on table public.kanji to anon, authenticated;
grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.user_progress to authenticated;

-- 4. Профили для пользователей, созданных до установки триггера on_auth_user_created
insert into public.users (id, email, is_anonymous)
select u.id,
       u.email,
       coalesce((u.raw_user_meta_data->>'is_anonymous')::boolean, false)
from auth.users u
on conflict (id) do nothing;

commit;
