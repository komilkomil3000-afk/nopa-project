import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/station_numbering.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// "مشارکت در چالش‌ها" and "زمان حضور در اپلیکیشن" cards of a report card.
///
/// [data] has the shape of one member of `caravan-progress` (or of `GET /usage/me`):
/// `challengesTotal`, `challengesParticipated`, `challengesByStation`, `usageDays`.
class ReportActivityCards extends StatelessWidget {
  final Map<String, dynamic>? data;
  final bool loaded;
  final List<Map<String, dynamic>> stations;

  const ReportActivityCards({super.key, required this.data, required this.loaded, required this.stations});

  static const int _usageDaysShown = 14;

  static String _ofText(int part, int total) => '${part.toPersian()} از ${total.toPersian()}';

  @override
  Widget build(BuildContext context) {
    final hasData = loaded && data != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _card(_participation(hasData)),
        const SizedBox(height: 18),
        _card(_usage(hasData)),
      ],
    );
  }

  /// Percentage of the visible challenges the user took part in, as a ring plus a bar per station.
  Widget _participation(bool hasData) {
    final total = (data?['challengesTotal'] as num?)?.toInt() ?? 0;
    final done = (data?['challengesParticipated'] as num?)?.toInt() ?? 0;
    final fraction = total == 0 ? 0.0 : (done / total).clamp(0.0, 1.0);
    final byStation = data?['challengesByStation'];
    final rows = <Widget>[];
    if (byStation is Map) {
      for (int i = 0; i < stations.length; i++) {
        final row = byStation[stations[i]['id']?.toString()];
        if (row is! Map) continue;
        final t = (row['total'] as num?)?.toInt() ?? 0;
        final d = (row['participated'] as num?)?.toInt() ?? 0;
        if (t == 0) continue;
        rows.add(Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            children: [
              SizedBox(width: 62, child: Text('منزلگاه ${StationNumbering.numberAt(i + 1).toPersian()}', style: AppTypography.caption.copyWith(color: const Color(0xFFDDD9EE)))),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (d / t).clamp(0.0, 1.0),
                    minHeight: 6,
                    backgroundColor: const Color(0xFF2E2D4A),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF9292E2)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 48, child: Text(_ofText(d, t), textAlign: TextAlign.left, style: AppTypography.caption.copyWith(color: const Color(0xFF9D99B8)))),
            ],
          ),
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('مشارکت در چالش‌ها', style: AppTypography.h3.copyWith(color: const Color(0xFFFFD580))),
        const SizedBox(height: 14),
        if (!loaded)
          const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Color(0xFFDFB690))))
        else if (!hasData)
          Text('اطلاعاتی دریافت نشد', style: AppTypography.captionMuted)
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 84,
                height: 84,
                child: CustomPaint(
                  painter: _DonutPainter(fraction: fraction, color: const Color(0xFFE5A66B), track: const Color(0xFF2E2D4A)),
                  child: Center(child: Text('${(fraction * 100).round().toPersian()}٪', style: AppTypography.h3)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      total == 0 ? 'چالشی برای این مسافر ثبت نشده است' : 'در ${done.toPersian()} چالش از ${total.toPersian()} چالش شرکت کرده است',
                      style: AppTypography.bodyMedium,
                    ),
                    ...rows,
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }

  /// Time in the app over the last two weeks, one bar per day.
  Widget _usage(bool hasData) {
    final usage = (data?['usageDays'] as Map?) ?? const {};
    // Days are counted in Tehran time, like on the server
    final tehranNow = DateTime.now().toUtc().add(const Duration(hours: 3, minutes: 30));
    final days = <DateTime>[for (int i = _usageDaysShown - 1; i >= 0; i--) tehranNow.subtract(Duration(days: i))];
    String key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final seconds = [for (final d in days) ((usage[key(d)] as num?)?.toInt() ?? 0)];
    final total = seconds.fold<int>(0, (a, b) => a + b);
    final activeDays = seconds.where((v) => v > 0).length;
    String fmt(int sec) {
      final m = (sec / 60).round();
      if (m < 60) return '${m.toPersian()} دقیقه';
      final h = m ~/ 60;
      final r = m % 60;
      return r == 0 ? '${h.toPersian()} ساعت' : '${h.toPersian()} ساعت و ${r.toPersian()} دقیقه';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('زمان حضور در اپلیکیشن', style: AppTypography.h3.copyWith(color: const Color(0xFFFFD580))),
        const SizedBox(height: 4),
        Text('${_usageDaysShown.toPersian()} روز اخیر', style: AppTypography.captionMuted),
        const SizedBox(height: 14),
        if (!loaded)
          const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Color(0xFFDFB690))))
        else if (!hasData)
          Text('اطلاعاتی دریافت نشد', style: AppTypography.captionMuted)
        else ...[
          SizedBox(
            height: 90,
            width: double.infinity,
            child: CustomPaint(
              painter: _BarsPainter(values: seconds.map((v) => v / 60.0).toList(), color: const Color(0xFF9292E2), track: const Color(0xFF2E2D4A)),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              for (final d in days)
                Expanded(
                  child: Center(
                    child: Text(Jalali.fromDateTime(d).day.toPersian(), style: AppTypography.caption.copyWith(fontSize: 9, color: const Color(0xFF9D99B8))),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _statBox('مجموع', total == 0 ? '—' : fmt(total)),
              _statBox('روزهای فعال', activeDays.toPersian()),
              _statBox('میانگین هر روز فعال', activeDays == 0 ? '—' : fmt((total / activeDays).round())),
            ],
          ),
          if (total == 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('هنوز زمانی ثبت نشده است. زمان حضور از نسخهٔ جدید اپ به بعد ثبت می‌شود.', style: AppTypography.captionMuted),
            ),
        ],
      ],
    );
  }

  static Widget _statBox(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: AppTypography.h2)),
          const SizedBox(height: 4),
          Text(label, style: AppTypography.captionMuted),
        ],
      ),
    );
  }

  /// Same bordered gradient box the other report-card cards use.
  static Widget _card(Widget child) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          stops: [0.0, 0.5, 1.0],
          colors: [Color(0xFF3A3A6A), Color(0xFF9292E2), Color(0xFF3A3A6A)],
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 8)),
        ],
      ),
      padding: const EdgeInsets.all(1.2),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20.8),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.53, 1.0],
            colors: [Color(0xFF3D3C67), Color(0xFF36345C), Color(0xFF333359)],
          ),
        ),
        child: child,
      ),
    );
  }
}

/// Ring showing [fraction] (0..1) of a whole.
class _DonutPainter extends CustomPainter {
  final double fraction;
  final Color color;
  final Color track;
  _DonutPainter({required this.fraction, required this.color, required this.track});

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 10.0;
    final rect = Rect.fromLTWH(stroke / 2, stroke / 2, size.width - stroke, size.height - stroke);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 6.283185307179586, false, base..color = track);
    if (fraction > 0) {
      canvas.drawArc(rect, -1.5707963267948966, 6.283185307179586 * fraction, false, base..color = color);
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.fraction != fraction || old.color != color || old.track != track;
}

/// One bar per value, the oldest on the right (the screen reads right to left); empty days show a short track.
class _BarsPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  final Color track;
  _BarsPainter({required this.values, required this.color, required this.track});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final maxV = values.fold<double>(0, (a, b) => b > a ? b : a);
    final slot = size.width / values.length;
    final barW = slot * 0.56;
    for (int i = 0; i < values.length; i++) {
      final x = size.width - (i + 1) * slot + (slot - barW) / 2;
      final v = values[i];
      final h = v <= 0 || maxV <= 0 ? 3.0 : (v / maxV * (size.height - 4)).clamp(4.0, size.height);
      final rrect = RRect.fromRectAndRadius(Rect.fromLTWH(x, size.height - h, barW, h), const Radius.circular(3));
      canvas.drawRRect(rrect, Paint()..color = v > 0 ? color : track);
    }
  }

  @override
  bool shouldRepaint(_BarsPainter old) => old.values != values || old.color != color;
}
