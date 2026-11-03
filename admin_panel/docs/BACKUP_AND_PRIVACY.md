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

نصب روی سرور بک‌اند:
```bash
chmod +x ~/nopa/deploy/backup.sh
mkdir -p ~/backups

# کلید رمزنگاری بکاپ (یک‌بار). کلید خصوصی را خارج از سرور نگه دارید!
gpg --quick-generate-key "nopa-backup" default default never
# یا ساده‌تر: یک پسورد در فایل
openssl rand -base64 32 > ~/.backup-pass && chmod 600 ~/.backup-pass

# ~/backup.env
cat > ~/backup.env <<'EOF'
BACKUP_PASSPHRASE_FILE=/home/ubuntu/.backup-pass     # یا BACKUP_GPG_RECIPIENT=nopa-backup
OFFSITE_TARGET=backup@OTHER_SERVER:/srv/nopa-backups/ # یا rclone:remote:nopa
KEEP_DAYS=14
CHAT_FILES_DIR=/home/ubuntu/nopa/chat-files           # همان مقدار .env
EOF

crontab -e
# 30 3 * * * /home/ubuntu/nopa/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```
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
