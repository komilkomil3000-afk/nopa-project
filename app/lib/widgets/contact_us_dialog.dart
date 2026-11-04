import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';
import 'package:provider/provider.dart';
import 'nopa_modal_shell.dart';

class ContactUsDialog extends StatelessWidget {
  final UserModel? user;

  const ContactUsDialog({super.key, this.user});

  static void show(BuildContext context, {UserModel? user}) {
    showNopaDialog(
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
    AppToast.info(context, '$label کپی شد: $text');
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: NopaModalShell(
          maxWidth: 420,
          headerIcon: Icons.headphones_rounded,
          title: 'ارتباط با ما',
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
          actions: [
            NopaModalAction(
              label: 'ارسال تیکت',
              onPressed: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, AppRoutes.tickets);
              },
            ),
            NopaModalAction(
              label: 'لغو',
              variant: NopaModalActionVariant.secondary,
              onPressed: () => Navigator.pop(context),
            ),
          ],
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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

                // 3. ایتا – بله – سروش (with chat on, the app itself is the channel)
                if (!Provider.of<AppRepository>(context, listen: false).currentUser.chatEnabled) ...[
                  _buildContactRow(
                    context,
                    label: 'ایتا – بله – سروش',
                    value: 'komeil-graph',
                    onTap: () => _launch(context, 'https://eitaa.com/komeil_graph'),
                  ),
                  const SizedBox(height: 12),
                ],

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

            ],
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
    return TapExpander(child: GestureDetector(
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
              style: AppTypography.bodyMedium.copyWith(color: Color(0xFFDDD9EE)),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 12),

          // 2. Value on LEFT (Second child in RTL)
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.left,
              style: AppTypography.bodyLarge.copyWith(color: AppColors.accentGoldEnd),
            ),
          ),
        ],
      ),
    ));
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
          child: Text(
            'لوکیشن:',
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFFDDD9EE)),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(width: 12),

        // 2. Location button on LEFT (Second child in RTL)
        Expanded(
          child: TapExpander(child: GestureDetector(
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
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_on_rounded, color: AppColors.accentGoldEnd, size: 18),
                  SizedBox(width: 6),
                  Text(
                    'مشاهده روی نقشه',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.accentGoldEnd),
                  ),
                ],
              ),
            ),
          )),
        ),
      ],
    );
  }
}
