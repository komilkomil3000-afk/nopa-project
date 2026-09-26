import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';

class ContactUsDialog extends StatelessWidget {
  final UserModel? user;

  const ContactUsDialog({super.key, this.user});

  static void show(BuildContext context, {UserModel? user}) {
    showDialog(
      context: context,
      barrierDismissible: true,
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
          _copyToClipboard(context, urlString, 'آدرس');
        }
      }
    } catch (_) {
      if (context.mounted) {
        _copyToClipboard(context, urlString, 'اطلاعات');
      }
    }
  }

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '$label کپی شد: $text',
          style: const TextStyle(fontFamily: AppTheme.fontFamily),
        ),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
          decoration: AppColors.loginDialogDecoration(radius: 24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header: Headphone Icon on right (in RTL) and Centered Title
                Stack(
                  alignment: Alignment.center,
                  children: [
                    // Headset Icon on right in RTL (aligned right)
                    const Align(
                      alignment: Alignment.centerRight,
                      child: Icon(
                        Icons.headphones_rounded,
                        color: Color(0xFF9E9CD6),
                        size: 34,
                      ),
                    ),

                    // Centered Title
                    const Text(
                      'ارتباط با ما',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // 1. تلفن همراه
                _buildContactRow(
                  context,
                  label: 'تلفن همراه:',
                  value: '09380346668',
                  onTap: () => _launch(context, 'tel:09380346668'),
                ),
                const SizedBox(height: 12),

                // 2. تلفن ثابت
                _buildContactRow(
                  context,
                  label: 'تلفن ثابت:',
                  value: '02537714589',
                  onTap: () => _launch(context, 'tel:02537714589'),
                ),
                const SizedBox(height: 12),

                // 3. ایتا – بله – سروش
                _buildContactRow(
                  context,
                  label: 'ایتا – بله – سروش',
                  value: 'komeil-graph',
                  onTap: () => _launch(context, 'https://eitaa.com/komeil_graph'),
                ),
                const SizedBox(height: 12),

                // 4. سایت
                _buildContactRow(
                  context,
                  label: 'سایت:',
                  value: 'www.esratm.ir',
                  onTap: () => _launch(context, 'https://www.esratm.ir'),
                ),
                const SizedBox(height: 12),

                // 5. ایمیل
                _buildContactRow(
                  context,
                  label: 'ایمیل:',
                  value: 'komilkomil200@gmail.com',
                  onTap: () => _launch(context, 'mailto:komilkomil200@gmail.com'),
                ),
                const SizedBox(height: 12),

                // 6. آدرس
                _buildContactRow(
                  context,
                  label: 'آدرس:',
                  value: 'قم، خیابان باجک1، کوچه34، پلاک12',
                  isAddress: true,
                  onTap: () => _copyToClipboard(context, 'قم، خیابان باجک1، کوچه34، پلاک12', 'آدرس'),
                ),
                const SizedBox(height: 12),

                // 7. لوکیشن
                _buildLocationRow(context),

                const SizedBox(height: 24),

                // Bottom Buttons: ارسال تیکت & لغو
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // ارسال تیکت (Right in RTL)
                    TextButton(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/tickets');
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      ),
                      child: const Text(
                        'ارسال تیکت',
                        style: TextStyle(
                          color: Color(0xFF9E9CD6),
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    // لغو (Left in RTL)
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      ),
                      child: const Text(
                        'لغو',
                        style: TextStyle(
                          color: Color(0xFF9E9CD6),
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Reusable Contact Row matching exact visual specification:
  /// In RTL Directionality: First child is on the RIGHT (Label Pill), Second child is on the LEFT (Value).
  Widget _buildContactRow(
    BuildContext context, {
    required String label,
    required String value,
    required VoidCallback onTap,
    bool isAddress = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        crossAxisAlignment: isAddress ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          // 1. Label Pill on RIGHT (First child in RTL)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6.5),
            decoration: BoxDecoration(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFF7A709E),
                width: 1.1,
              ),
            ),
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFFDDD9EE),
                fontSize: 12,
                fontWeight: FontWeight.w500,
                fontFamily: AppTheme.fontFamily,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 12),

          // 2. Value on LEFT (Second child in RTL)
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.left,
              style: const TextStyle(
                color: Color(0xFFE1BC96),
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                height: 1.4,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Location Row: Label Pill on RIGHT (First child in RTL) and Map/Pin Button on LEFT (Second child in RTL)
  Widget _buildLocationRow(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // 1. Label Pill on RIGHT (First child in RTL)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6.5),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: const Color(0xFF7A709E),
              width: 1.1,
            ),
          ),
          child: const Text(
            'لوکیشن:',
            style: TextStyle(
              color: Color(0xFFDDD9EE),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(width: 12),

        // 2. Location button on LEFT (Second child in RTL)
        Expanded(
          child: GestureDetector(
            onTap: () => _launch(context, 'https://maps.google.com/?q=34.6416,50.8746'),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF221E3A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: const Color(0xFF7A709E).withValues(alpha: 0.6),
                  width: 1.0,
                ),
              ),
              alignment: Alignment.center,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_on_rounded, color: Color(0xFFE1BC96), size: 18),
                  SizedBox(width: 6),
                  Text(
                    'مشاهده روی نقشه',
                    style: TextStyle(
                      color: Color(0xFFE1BC96),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
