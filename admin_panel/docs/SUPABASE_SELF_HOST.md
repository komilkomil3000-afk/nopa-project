# راهنمای نصب Supabase سلف‌هاستد برای بک‌اند نوپا

معماری: اپ فلاتر و پنل ادمین ← API بک‌اند Express ← Prisma ← PostgreSQL روی Supabase.
اپ فلاتر مستقیم به Supabase وصل نمی‌شود.

## ۱. سرور
- یک VPS اوبونتو 22.04 یا 24.04 داخل ایران، با حداقل ۴ گیگ رم، ۲ هسته و ۴۰ گیگ دیسک.
- یک رکورد DNS از نوع A برای `db.nopa-app.ir` به IP سرور، **حتماً در حالت DNS only** (بدون پروکسی ابر آروان؛ پروکسی فقط HTTP/HTTPS را رد می‌کند و پورت‌های دیتابیس کار نمی‌کنند).

## ۲. نصب Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # اجازه‌ی استفاده از docker بدون sudo
newgrp docker                   # یا یک بار logout/login کنید
docker --version && docker compose version
```
اگر دانلود ایمیج‌ها از Docker Hub بسته بود، یک میرور ایرانی را در `/etc/docker/daemon.json` تنظیم کنید (قبلش مطمئن شوید که میرور فعال است):
```json
{ "registry-mirrors": ["https://docker.arvancloud.ir"] }
```
```bash
sudo systemctl restart docker
```

## ۳. دریافت Supabase
```bash
git clone --depth 1 https://github.com/supabase/supabase
mkdir supabase-project
cp -rf supabase/docker/* supabase-project
cp supabase/docker/.env.example supabase-project/.env
cd supabase-project
```

## ۴. تنظیم فایل `.env` سوپابیس
حتماً این مقادیر را عوض کنید:

| کلید | مقدار |
|---|---|
| `POSTGRES_PASSWORD` | پسورد قوی، فقط حروف و عدد تا در URL مشکل ایجاد نکند |
| `JWT_SECRET` | رشته‌ی تصادفی حداقل ۳۲ کاراکتری |
| `ANON_KEY` و `SERVICE_ROLE_KEY` | با ابزار تولید کلید در صفحه‌ی Self-Hosting مستندات Supabase و از روی همان `JWT_SECRET` ساخته شوند |
| `DASHBOARD_USERNAME` و `DASHBOARD_PASSWORD` | نام کاربری و رمز ورود به پنل Studio |
| `POOLER_TENANT_ID` | یک شناسه، مثلاً `nopa` |
| `SITE_URL`، `API_EXTERNAL_URL` و `SUPABASE_PUBLIC_URL` | آدرس سرور |

برای ساخت رشته‌ی تصادفی: `openssl rand -hex 32`

## ۵. اجرا
از داخل پوشه‌ی `supabase-project` (همان که `.env` را در آن ویرایش کردید):
```bash
docker compose pull
docker compose up -d
docker compose ps   # همه‌ی سرویس‌ها باید healthy باشند
```

## ۶. ساخت جدول‌ها
1. پنل Studio را در `http://db.nopa-app.ir:8000` باز کنید و با `DASHBOARD_USERNAME` و `DASHBOARD_PASSWORD` وارد شوید.
2. به **SQL Editor** بروید، کل محتوای `supabase/001_init.sql` را paste کنید و **Run** را بزنید.
3. در Table Editor باید ۴۴ جدول ببینید که RLS روی همه‌شان فعال است.

> چرا RLS؟ Supabase همه‌ی جدول‌ها را از طریق REST API عمومی در دسترس می‌گذارد. با فعال بودن RLS و بدون هیچ policy، کلید عمومی (anon) به هیچ داده‌ای دسترسی ندارد. بک‌اند با یوزر `postgres` وصل می‌شود و این محدودیت رویش اثری ندارد.

## ۷. اتصال بک‌اند
در `.env` بک‌اند این دو مقدار را بگذارید:
```
DATABASE_URL="postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@db.nopa-app.ir:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@db.nopa-app.ir:5432/postgres"
```
بعد (از پوشه‌ی بک‌اند):
```bash
npx prisma migrate resolve --applied 0_init   # یک بار: ثبت می‌کند که SQL اولیه اجرا شده
npx prisma migrate status                     # باید Database schema is up to date نشان دهد
# ⚠️ seed کل دیتابیس را پاک می‌کند؛ فقط روی دیتابیس آزمایشی و با: ALLOW_DB_WIPE=1 NODE_ENV=development npm run db:seed
npm run dev
```
برای تغییرات بعدی schema: در محیط توسعه `npx prisma migrate dev --name <name>`. موقع دیپلوی، `prisma migrate deploy` اجرا می‌شود.

## ۸. دیپلوی روی سرور بک‌اند (git push)
فایل `deploy/post-receive` همین پروژه را در `~/repos/nopa.git/hooks/post-receive` سرور بگذارید و `chmod +x` بزنید.
فایل `.env` واقعی را **بیرون از پوشه‌ی deploy** در `~/nopa.env` نگه دارید، چون هر deploy پوشه‌ی `~/nopa` را بازسازی می‌کند؛ hook آن را کپی می‌کند.

## ۹. امنیت
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow from <BACKEND_IP> to any port 5432
sudo ufw allow from <BACKEND_IP> to any port 6543
sudo ufw enable
```
- Docker پورت‌هایی را که publish می‌کند از ufw رد می‌کند. پس پورت‌های 5432 و 6543 و 8000 را در `docker-compose.yml` محدود کنید، یا فایروال پنل ابری را هم ببندید.
- جلوی پورت 8000 یک Nginx یا Caddy با HTTPS بگذارید.
- هیچ‌وقت پسوردهای پیش‌فرض را در محیط واقعی نگه ندارید.

## ۱۰. بکاپ روزانه
```bash
crontab -e
0 3 * * * docker exec supabase-db pg_dump -U postgres postgres > /root/backups/nopa_$(date +\%F).sql
```
