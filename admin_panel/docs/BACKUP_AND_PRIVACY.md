# بکاپ و حفاظت از محتوای چت

## کجا چه چیزی ذخیره می‌شود
| محتوا | محل | دسترسی |
|---|---|---|
| متن پیام‌ها | جدول `ChatMessage` در PostgreSQL | فقط از طریق API با احراز هویت و بررسی عضویت در گروه |
| ویس، عکس، فیلم، فایل | `CHAT_FILES_DIR` روی دیسک سرور (پیش‌فرض `chat-files/`) | هیچ مسیر استاتیک ندارد؛ فقط با لینک امضاشده‌ی یک‌ساعته‌ی `/api/v1/chat/files/:id?t=...` |
| کاور و آواتار کاروان‌ها | `uploads/` | عمومی (عمداً) |

لایه‌های حفاظتی که در کد هست:
- پوشه‌ی فایل‌ها در git نیست (`.gitignore`) و با دسترسی `700` ساخته می‌شود و هر فایل بعد از آپلود `600` می‌شود.
- نام فایل روی دیسک تصادفی است و نوع فایل از لیست مجاز پسوندها می‌آید، نه از کلاینت.
- فایل‌ها با `nosniff` و CSP `sandbox` ارسال می‌شوند، پس حتی فایل مخرب نمی‌تواند روی دامنه اجرا شود.
- لینک فایل منقضی می‌شود و بعد از حذف پیام یا خاموش‌شدن چت کار نمی‌کند.

## چیزهایی که باید روی خود سرور رعایت شود (از کد قابل انجام نیست)
1. **رمزنگاری دیسک** (LUKS) یا حداقل رمزنگاری دیسک ابری، چون متن چت‌ها و فایل‌ها داخل DB و دیسک به‌صورت عادی ذخیره می‌شوند.
2. پورت‌های دیتابیس (5432 و 6543) فقط برای IP بک‌اند باز باشد (بخش ۹ در `SUPABASE_SELF_HOST.md`).
3. بهتر است `CHAT_FILES_DIR` را بیرون از پوشه‌ی deploy بگذارید، مثلاً `/home/ubuntu/nopa-data/chat-files` (در `~/nopa.env` تنظیم کنید) تا هیچ deploy یا پاکسازی پوشه‌ی برنامه به آن نرسد.
4. هر کسی که به سرور یا DB دسترسی ادمین دارد می‌تواند چت‌ها را بخواند. این رمزنگاری سرتاسری نیست.

## بکاپ
اسکریپت [`deploy/backup.sh`](../deploy/backup.sh) هر شب این‌ها را در یک آرشیو می‌گذارد: دیتابیس (pg_dump)، فایل‌های چت، `uploads/` و `.env`.

نصب روی سرور بک‌اند (قدم‌به‌قدم؛ حالت پیش‌فرض: دیتابیس و بک‌اند روی یک سرور هستند و بکاپ با `docker exec supabase-db` گرفته می‌شود):

**۱. کد را deploy کنید** تا `deploy/backup.sh` روی سرور برسد (همان `git push` معمول به ریموت سرور).

**۲. ابزارها**
```bash
sudo apt install -y postgresql-client gnupg rsync
pg_dump --version      # باید >= نسخه‌ی PostgreSQL سرور دیتابیس باشد (روی سرور دیتابیس: docker exec supabase-db psql -V)
```

**۳. مسیر داده‌ی چت بیرون از پوشه‌ی deploy**
```bash
mkdir -p ~/nopa-data/chat-files && chmod 700 ~/nopa-data/chat-files
echo 'CHAT_FILES_DIR=/home/ubuntu/nopa-data/chat-files' >> ~/nopa.env
# اگر فایل چت قبلی در ~/nopa/chat-files هست آن را منتقل کنید:
[ -d ~/nopa/chat-files ] && cp -a ~/nopa/chat-files/. ~/nopa-data/chat-files/
cp ~/nopa.env ~/nopa/.env && pm2 restart nopa --update-env
```

**۴. پسورد رمزنگاری بکاپ**
```bash
openssl rand -base64 32 > ~/.backup-pass && chmod 600 ~/.backup-pass
cat ~/.backup-pass     # همین را در password manager بگذارید (خارج از سرور)
```

**۵. فایل تنظیم `~/backup.env`** (`TENANT` و `PASSWORD` را از `DIRECT_URL` داخل `~/nopa.env` بردارید)
```bash
cat > ~/backup.env <<'EOF'
BACKUP_PASSPHRASE_FILE=/home/ubuntu/.backup-pass
CHAT_FILES_DIR=/home/ubuntu/nopa-data/chat-files
KEEP_DAYS=14
# فقط اگر دیتابیس روی سرور جدا است، خط بعد را از حالت کامنت دربیاورید:
# DATABASE_URL="postgresql://postgres.TENANT:PASSWORD@db.nopa-app.ir:5432/postgres"
OFFSITE_TARGET=backup@OTHER_SERVER:/srv/nopa-backups/
EOF
chmod 600 ~/backup.env
```
- `DATABASE_URL` فقط برای دیتابیسِ روی سرور جدا است و آن‌وقت **باید** اتصال مستقیم (پورت 5432، بدون `pgbouncer`) و نسخه‌ی `pg_dump` میزبان >= نسخه‌ی دیتابیس باشد. در حالت یک‌سرور از `pg_dump` داخل کانتینر استفاده می‌شود و نسخه‌ی میزبان مهم نیست.
- برای `OFFSITE_TARGET` با rsync، کلید SSH سرور بک‌اند باید روی ماشین مقصد در `authorized_keys` باشد و یک‌بار دستی `ssh backup@OTHER_SERVER` بزنید تا host key تأیید شود. به‌جایش می‌شود `rclone:remote:nopa` گذاشت.

**۶. اجرای دستی و بررسی**
```bash
chmod +x ~/nopa/deploy/backup.sh && mkdir -p ~/backups
~/nopa/deploy/backup.sh
ls -lh ~/backups       # باید nopa_*.tar.gpg و .sha256 باشد و در خروجی WARNING نباشد
ssh backup@OTHER_SERVER ls -lh /srv/nopa-backups/    # فایل باید آنجا هم باشد
```

**۷. زمان‌بندی شبانه**
```bash
crontab -e
# 30 3 * * * /home/ubuntu/nopa/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```
اگر قبلاً کرون ساده‌ی `pg_dump` از بخش ۱۰ `SUPABASE_SELF_HOST.md` را روی سرور دیتابیس گذاشته‌اید، می‌توانید به‌عنوان بکاپ دوم نگهش دارید.

**۸. همان لحظه یک بازیابی تمرینی** انجام دهید (بخش «بازیابی» پایین).
نکته‌ها:
- بکاپی که فقط روی همان سرور است با خود سرور از بین می‌رود. `OFFSITE_TARGET` را حتماً به ماشین یا فضای دیگری تنظیم کنید.
- پسورد/کلید رمزگشایی را جدا از بکاپ نگه دارید (مثلاً در password manager). بدون آن بکاپ بی‌فایده است.
- اسکریپت خودش چک می‌کند dump خالی یا ناقص نباشد، و فایل `.sha256` کنار هر آرشیو می‌گذارد.

## بازیابی (حتماً یک‌بار تمرین کنید)
```bash
mkdir restore && cd restore
gpg -d ../nopa_2026-11-03_0330.tar.gpg > b.tar && tar -xf b.tar     # نام فایل را عوض کنید
zcat db.sql.gz | docker exec -i supabase-db psql -U postgres postgres
mkdir -p $CHAT_FILES_DIR && tar -xzf chat-files.tar.gz -C $CHAT_FILES_DIR
tar -xzf uploads.tar.gz -C ~/nopa/uploads
chmod 700 $CHAT_FILES_DIR && chmod 600 $CHAT_FILES_DIR/*
pm2 restart nopa-backend
```
هر چند ماه یک بار بازیابی را روی یک سرور تست انجام دهید؛ بکاپ تست‌نشده بکاپ نیست.

## بعد از نصب، هر چند وقت باید کاری کرد؟
نصب یک‌باره است و بکاپ خودکار اجرا می‌شود، ولی بدون نگاه‌کردن گاه‌به‌گاه، خراب‌شدن بی‌صدای آن را نمی‌فهمید:
- **هفتگی (۲ دقیقه):** `tail -n 5 ~/backups/backup.log` باید `backup done` با تاریخ دیشب نشان دهد؛ حجم فایل منطقی باشد و روی ماشین مقصد هم فایل جدید باشد.
- **ماهانه:** `df -h` روی هر دو سرور (پر نشدن دیسک) و `sudo apt update && sudo apt upgrade`.
- **هر ۳ تا ۶ ماه:** بازیابی کامل روی سرور تست.
- **هر بار سرور، آدرس مقصد، پسورد DB یا دامنه عوض شد:** چک‌لیست [`SERVER_CHECKLIST.md`](SERVER_CHECKLIST.md).
- **هشدار خودکار (اختیاری):** آخر `backup.sh` یک `curl` به سرویس مانیتورینگ ساده (healthchecks.io یا ربات تلگرام) اضافه کنید تا نرسیدن بکاپ خبر شود.
