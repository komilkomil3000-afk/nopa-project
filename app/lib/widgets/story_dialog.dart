import 'package:flutter/material.dart';
import '../core/theme/app_typography.dart';
import 'nopa_modal_shell.dart';

/// "Journey to the land of Nopa" story popup, shared by the student and mentor profiles.
class StoryDialog {
  StoryDialog._();

  static Future<void> show(BuildContext context) {
    return showNopaModal<void>(
      context,
      builder: (ctx) => NopaModalShell(
        maxWidth: 420,
        headerIcon: Icons.auto_stories_rounded,
        title: 'داستان سفر به سرزمین نپا',
        actions: [
          NopaModalAction(
            label: 'متوجه شدم',
            onPressed: () => Navigator.pop(ctx),
          ),
        ],
        child: Text(
          'علاءالملک، حاکم سرزمین نپا با گنجینه‌ای حیرت‌آور و بی‌نظیر در انتظار زنان و مردانی است که شایستگی خود را برای کسب آن نشان دهند.\n\n'
          'تو در این مسیر، عضو کاروانی هستی که راهبری زبردست شما را به سوی سرزمین نپا می‌برد. مسیر مابین هر منزلگاه، عیار هر کس را می‌سنجد و توقف موقت هر کاروان در این منزلگاه‌ها، مقدمه‌ای برای طی کردن مسیرهای دشوار بعدی است.',
          textAlign: TextAlign.justify,
          style: AppTypography.bodyBold01White.copyWith(
            fontSize: 12.5,
            height: 1.6,
            fontWeight: FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
