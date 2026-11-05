import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/asset_names.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/models.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/info_reveal.dart';

/// The caravan's score for its mentor, exactly as «برترین کاروان‌ها» counts it: the total value in زریک
/// (کلاف counts only once turned into قالیچه), the value per member that orders the caravans, the banner points
/// that break a tie, and its place.
/// Shown on the mentor's home, market and profile so the three always agree with the ranking.
class CaravanStandingSummary extends StatelessWidget {
  final CaravanModel? caravan;
  const CaravanStandingSummary({super.key, required this.caravan});

  static String _format(int n) =>
      n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',').toPersianDigits();

  @override
  Widget build(BuildContext context) {
    final c = caravan;
    if (c == null) return const SizedBox.shrink();
    final label = AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB));
    final value = AppTypography.caption.copyWith(color: const Color(0xFFFFD580), fontWeight: FontWeight.w800);
    Widget item(String title, String text) => Text.rich(
          TextSpan(children: [TextSpan(text: '$title: ', style: label), TextSpan(text: text, style: value)]),
        );
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0xFF282548).withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF6C649B).withValues(alpha: 0.28), width: 0.9),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceAround,
              spacing: 12,
              runSpacing: 6,
              children: [
                item('ارزش سرمایه (معادل ${AssetNames.of('zarik')})', _format(c.totalWealth)),
                item('سرانه‌ی هر نفر', _format(c.averageWealth)),
                item('امتیاز ${AssetNames.of('derafsh')}', _format(c.bannerPoints)),
                item('رتبه‌ی کاروان', c.rank == null ? '-' : '${c.rank}'.toPersianDigits() + (c.rankOf > 0 ? ' از ${c.rankOf}'.toPersianDigits() : '')),
              ],
            ),
            const SizedBox(height: 4),
            // hidden until tapped
            InfoReveal(
              text: 'ارزش سرمایه = ${AssetNames.of('zarik')} + ${AssetNames.of('farsh')} به قیمتش؛ ${AssetNames.of('nakh')} تا تبدیل نشود حساب نمی‌شود. '
                  'رتبه با سرانه است و در تساوی، امتیاز ${AssetNames.of('derafsh')} (طلایی ۲۰، نقره‌ای ۱۰، برنزی ۵، پارچه‌ای ۱).',
            ),
          ],
        ),
      ),
    );
  }
}
