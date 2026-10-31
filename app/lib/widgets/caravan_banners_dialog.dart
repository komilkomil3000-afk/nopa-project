import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/asset_names.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// Banners (درفش) the caravan has won: totals per tier and where each one was earned.
class CaravanBannersDialog extends StatelessWidget {
  final Map<String, dynamic> data;
  const CaravanBannersDialog({super.key, required this.data});

  static Future<void> show(BuildContext context, Map<String, dynamic> data) {
    return showDialog<void>(context: context, builder: (_) => CaravanBannersDialog(data: data));
  }

  static const _tiers = [
    ('gold', 'derafsh_gold', Color(0xFFFBBF24)),
    ('silver', 'derafsh_silver', Color(0xFFCBD5E1)),
    ('bronze', 'derafsh_bronze', Color(0xFFD97706)),
    ('cloth', 'derafsh_cloth', Color(0xFF94A3B8)),
  ];

  String _date(dynamic v) {
    final dt = DateTime.tryParse(v?.toString() ?? '')?.toLocal();
    if (dt == null) return '';
    final j = Jalali.fromDateTime(dt);
    return '${j.year}/${j.month.toString().padLeft(2, '0')}/${j.day.toString().padLeft(2, '0')}'.toPersianDigits();
  }

  @override
  Widget build(BuildContext context) {
    final byTier = (data['byTier'] as Map?) ?? const {};
    final items = (data['items'] as List?)?.whereType<Map>().toList() ?? const [];
    final total = (data['total'] as num?)?.toInt() ?? 0;

    TextStyle style(double size, {Color color = Colors.white, bool bold = false}) => TextStyle(
          color: color,
          fontSize: size,
          fontWeight: bold ? FontWeight.bold : FontWeight.w500,
          fontFamily: AppTheme.fontFamily,
          fontFamilyFallback: AppTheme.fontFamilyFallback,
        );

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420, maxHeight: 560),
          padding: const EdgeInsets.all(20),
          decoration: AppColors.loginDialogDecoration(radius: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: Text('${AssetNames.of('derafsh')} کاروان: ${total.toString().toPersianDigits()}', style: style(16, bold: true))),
              const SizedBox(height: 14),
              for (final t in _tiers)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Icon(Icons.flag_rounded, size: 16, color: t.$3),
                      const SizedBox(width: 8),
                      Expanded(child: Text(AssetNames.of(t.$2), style: style(12.5, color: t.$3, bold: true))),
                      Text(((byTier[t.$1] as num?)?.toInt() ?? 0).toString().toPersianDigits(), style: style(13, bold: true)),
                    ],
                  ),
                ),
              const Divider(color: Color(0xFF4C4578), height: 22),
              Flexible(
                child: items.isEmpty
                    ? Center(child: Text('هنوز درفشی کسب نشده است.', style: style(12, color: const Color(0xFF9D99B8))))
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final it = items[i];
                          final tier = it['tier']?.toString() ?? 'cloth';
                          final color = _tiers.firstWhere((t) => t.$1 == tier, orElse: () => _tiers.last).$3;
                          final station = it['stationTitle']?.toString();
                          return Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: color.withValues(alpha: 0.4), width: 0.9),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.flag_rounded, size: 14, color: color),
                                    const SizedBox(width: 6),
                                    Expanded(child: Text(AssetNames.of('derafsh_$tier'), style: style(12, color: color, bold: true))),
                                    Text(_date(it['createdAt']), style: style(10, color: const Color(0xFF9D99B8))),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text('چالش: ${it['challengeTitle'] ?? ''}', style: style(11.5)),
                                Text('منزلگاه: ${(station != null && station.isNotEmpty) ? station : 'عمومی'}', style: style(11, color: const Color(0xFFB8B5CE))),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('بستن', style: style(14, color: const Color(0xFF9E9CD6), bold: true)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
