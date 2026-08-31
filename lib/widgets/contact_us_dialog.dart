import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';

class ContactUsDialog extends StatelessWidget {
  final UserModel? user;

  const ContactUsDialog({super.key, this.user});

  static void show(BuildContext context, {UserModel? user}) {
    showDialog(
      context: context,
      builder: (context) => ContactUsDialog(user: user),
    );
  }

  Future<void> _launch(BuildContext context, String urlString) async {
    try {
      final uri = Uri.parse(urlString);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'امکان باز کردن آدرس وجود ندارد: $urlString',
                style: const TextStyle(fontFamily: 'Vazirmatn'),
              ),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'خطا در اجرای لینک: $e',
              style: const TextStyle(fontFamily: 'Vazirmatn'),
            ),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '$label کپی شد: $text',
          style: const TextStyle(fontFamily: 'Vazirmatn'),
        ),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = user ?? Provider.of<AppRepository>(context, listen: false).currentUser;
    final mentorName = (currentUser.caravanMentor != null && currentUser.caravanMentor!.isNotEmpty && currentUser.caravanMentor != 'تعیین نشده')
        ? currentUser.caravanMentor!
        : 'راهبر کاروان شما';
    final mentorSocialLink = (currentUser.socialGroupLink != null && currentUser.socialGroupLink!.trim().isNotEmpty)
        ? currentUser.socialGroupLink!.trim()
        : 'https://eitaa.com/nopaeita';

    return Dialog(
      backgroundColor: const Color(0xFF1E1435),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        constraints: const BoxConstraints(maxWidth: 420),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Row(
                    children: const [
                      Text(
                        'پشتیبانی و تماس با ما',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      SizedBox(width: 8),
                      Icon(
                        Icons.headset_mic_rounded,
                        color: Color(0xFF38BDF8),
                        size: 22,
                      ),
                    ],
                  ),
                ],
              ),
              const Divider(color: Colors.white12, height: 24),

              // Mentor Virtual Space / Channel Card
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2E1A52), Color(0xFF1E1038)],
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFFFD54F).withValues(alpha: 0.5),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD54F).withValues(alpha: 0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD54F).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'کانال ارتباطی',
                            style: TextStyle(
                              color: Color(0xFFFFD54F),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                        ),
                        Row(
                          children: [
                            Text(
                              'فضای مجازی $mentorName',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(
                              Icons.groups_rounded,
                              color: Color(0xFFFFD54F),
                              size: 18,
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'جهت ارتباط مستقیم با راهبر، دریافت برنامه‌ها و اطلاعیه‌های کاروان، روی دکمه زیر کلیک نمایید:',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11.5,
                        height: 1.4,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: () {
                        String targetUrl = mentorSocialLink;
                        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                          if (targetUrl.startsWith('@')) {
                            targetUrl = 'https://eitaa.com/${targetUrl.substring(1)}';
                          } else {
                            targetUrl = 'https://eitaa.com/$targetUrl';
                          }
                        }
                        _launch(context, targetUrl);
                      },
                      icon: const Icon(Icons.open_in_new_rounded, size: 16, color: Colors.black87),
                      label: const Text(
                        'ورود به فضای مجازی راهبر',
                        style: TextStyle(
                          color: Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 12.5,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFFD54F),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Contact Items
              _buildActionTile(
                context,
                title: 'شماره تماس پشتیبانی',
                value: '09380346668',
                displayValue: '۰۹۳۸۰۳۴۶۶۶۸',
                icon: Icons.phone_in_talk_rounded,
                accentColor: const Color(0xFF10B981),
                actionIcon: Icons.call,
                actionLabel: 'تماس',
                onAction: () => _launch(context, 'tel:09380346668'),
                onCopy: () => _copyToClipboard(context, '09380346668', 'شماره تماس'),
              ),
              const SizedBox(height: 10),

              _buildActionTile(
                context,
                title: 'ایمیل پشتیبانی',
                value: 'nopa@gmail.com',
                displayValue: 'nopa@gmail.com',
                icon: Icons.alternate_email_rounded,
                accentColor: const Color(0xFF38BDF8),
                actionIcon: Icons.email_outlined,
                actionLabel: 'ارسال ایمیل',
                onAction: () => _launch(context, 'mailto:nopa@gmail.com'),
                onCopy: () => _copyToClipboard(context, 'nopa@gmail.com', 'ایمیل پشتیبانی'),
              ),
              const SizedBox(height: 10),

              _buildActionTile(
                context,
                title: 'شبکه اجتماعی نپا',
                value: 'https://eitaa.com/nopaeita',
                displayValue: 'nopaeita (کانال رسمی ایتا)',
                icon: Icons.chat_bubble_outline_rounded,
                accentColor: const Color(0xFFF97316),
                actionIcon: Icons.open_in_browser_rounded,
                actionLabel: 'مشاهده',
                onAction: () => _launch(context, 'https://eitaa.com/nopaeita'),
                onCopy: () => _copyToClipboard(context, 'nopaeita', 'شناسه ایتا'),
              ),
              const SizedBox(height: 10),

              _buildActionTile(
                context,
                title: 'آدرس وب‌سایت رسمی',
                value: 'https://www.nopa.ir',
                displayValue: 'www.nopa.ir',
                icon: Icons.language_rounded,
                accentColor: const Color(0xFF8B5CF6),
                actionIcon: Icons.open_in_new_rounded,
                actionLabel: 'باز کردن',
                onAction: () => _launch(context, 'https://www.nopa.ir'),
                onCopy: () => _copyToClipboard(context, 'www.nopa.ir', 'آدرس سایت'),
              ),
              const SizedBox(height: 10),

              // Address Tile
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.copy_rounded, size: 16, color: Colors.white54),
                      tooltip: 'کپی نشانی',
                      onPressed: () => _copyToClipboard(context, 'سراسر کشور دفاتر ائمه جمعه', 'نشانی'),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const Spacer(),
                    Expanded(
                      flex: 8,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: const [
                          Text(
                            'نشانی مرکز',
                            style: TextStyle(
                              color: Colors.white54,
                              fontSize: 11,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'سراسر کشور دفاتر ائمه جمعه',
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        color: Color(0xFFEF4444),
                        size: 18,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionTile(
    BuildContext context, {
    required String title,
    required String value,
    required String displayValue,
    required IconData icon,
    required Color accentColor,
    required IconData actionIcon,
    required String actionLabel,
    required VoidCallback onAction,
    required VoidCallback onCopy,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        children: [
          // Action button (Call/Email/Browse)
          InkWell(
            onTap: onAction,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: accentColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(actionIcon, size: 14, color: accentColor),
                  const SizedBox(width: 4),
                  Text(
                    actionLabel,
                    style: TextStyle(
                      color: accentColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Copy button
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 16, color: Colors.white38),
            tooltip: 'کپی',
            onPressed: onCopy,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),

          const Spacer(),

          // Details text
          Expanded(
            flex: 6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  displayValue,
                  textAlign: TextAlign.right,
                  textDirection: TextDirection.ltr,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Leading Icon
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              color: accentColor,
              size: 18,
            ),
          ),
        ],
      ),
    );
  }
}
