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

  Widget _usage(bool hasData) => _UsageCard(data: data, loaded: loaded, hasData: hasData);

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

/// «زمان حضور در اپلیکیشن»: hourly (one day), weekly (the Jalali week, Saturday to Friday, the default) or monthly
/// (a strip of days, 10 before and 10 after today in view, scrolling sideways for the rest). Days are Tehran days
/// and the dates are the real Jalali calendar.
class _UsageCard extends StatefulWidget {
  final Map<String, dynamic>? data;
  final bool loaded;
  final bool hasData;
  const _UsageCard({required this.data, required this.loaded, required this.hasData});

  @override
  State<_UsageCard> createState() => _UsageCardState();
}

enum _UsageMode { daily, weekly, monthly }

typedef _Series = ({List<double> values, List<String> labels, List<String> captions, int today, List<bool> future});

class _UsageCardState extends State<_UsageCard> {
  _UsageMode _mode = _UsageMode.weekly;
  int _dayOffset = 0; // daily: days back from today
  int _weekOffset = 0; // weekly: weeks back from this week
  int? _picked; // index of the bar the person touched
  final ScrollController _scroll = ScrollController();
  bool _scrolledToToday = false;

  static const int _historyDays = 90; // what the server keeps in the answer
  static const int _hoursDays = 14; // days with an hour-by-hour breakdown
  static const int _monthBefore = 89;
  static const int _monthAfter = 10;
  static const List<String> _weekNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  // Today in Tehran as a date-only UTC value (Iran has no daylight saving time any more)
  static DateTime get _today {
    final t = DateTime.now().toUtc().add(const Duration(hours: 3, minutes: 30));
    return DateTime.utc(t.year, t.month, t.day);
  }

  static String _key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Map get _days => (widget.data?['usageDays'] as Map?) ?? const {};
  Map get _hours => (widget.data?['usageHours'] as Map?) ?? const {};

  double _secondsOf(DateTime d) => ((_days[_key(d)] as num?)?.toDouble() ?? 0);

  List<double> _hoursOf(DateTime d) {
    final row = _hours[_key(d)];
    if (row is List) return [for (int i = 0; i < 24; i++) i < row.length ? ((row[i] as num?)?.toDouble() ?? 0) : 0];
    return List.filled(24, 0);
  }

  static String _fmt(double sec) {
    final m = (sec / 60).round();
    if (m < 1 && sec > 0) return 'کمتر از یک دقیقه';
    if (m < 60) return '${m.toPersian()} دقیقه';
    final h = m ~/ 60;
    final r = m % 60;
    return r == 0 ? '${h.toPersian()} ساعت' : '${h.toPersian()} ساعت و ${r.toPersian()} دقیقه';
  }

  static String _dateText(DateTime d) {
    final j = Jalali.fromDateTime(d);
    return '${_weekNames[j.weekDay - 1]} ${j.day.toPersian()} ${j.formatter.mN} ${j.year.toPersian()}';
  }

  /// Bars of the current mode: values (seconds), labels, the touched-bar captions and the index of today (or -1).
  _Series _series() {
    final today = _today;
    switch (_mode) {
      case _UsageMode.daily:
        final day = today.subtract(Duration(days: _dayOffset));
        return (
          values: _hoursOf(day),
          labels: [for (int h = 0; h < 24; h++) h % 3 == 0 ? h.toPersian() : ''],
          captions: [for (int h = 0; h < 24; h++) 'ساعت ${h.toPersian()} تا ${(h + 1).toPersian()}'],
          today: -1,
          future: List.filled(24, false),
        );
      case _UsageMode.weekly:
        final j = Jalali.fromDateTime(today);
        final start = today.subtract(Duration(days: j.weekDay - 1 + _weekOffset * 7));
        final days = [for (int i = 0; i < 7; i++) start.add(Duration(days: i))];
        return (
          values: [for (final d in days) d.isAfter(today) ? 0.0 : _secondsOf(d)],
          labels: [for (int i = 0; i < 7; i++) _weekNames[i]],
          captions: [for (final d in days) _dateText(d)],
          today: days.indexWhere((d) => d == today),
          future: [for (final d in days) d.isAfter(today)],
        );
      case _UsageMode.monthly:
        final first = today.subtract(const Duration(days: _monthBefore));
        final total = _monthBefore + _monthAfter + 1;
        final days = [for (int i = 0; i < total; i++) first.add(Duration(days: i))];
        return (
          values: [for (final d in days) d.isAfter(today) ? 0.0 : _secondsOf(d)],
          labels: [for (final d in days) Jalali.fromDateTime(d).day.toPersian()],
          captions: [for (final d in days) _dateText(d)],
          today: _monthBefore,
          future: [for (final d in days) d.isAfter(today)],
        );
    }
  }

  void _setMode(_UsageMode m) => setState(() {
        _mode = m;
        _picked = null;
        _scrolledToToday = false;
      });

  bool get _canGoOlder => _mode == _UsageMode.daily ? _dayOffset < _hoursDays - 1 : (_mode == _UsageMode.weekly ? _weekOffset < _historyDays ~/ 7 - 1 : false);
  bool get _canGoNewer => _mode == _UsageMode.daily ? _dayOffset > 0 : (_mode == _UsageMode.weekly ? _weekOffset > 0 : false);

  void _step(int dir) => setState(() {
        _picked = null;
        if (_mode == _UsageMode.daily) _dayOffset = (_dayOffset + dir).clamp(0, _hoursDays - 1);
        if (_mode == _UsageMode.weekly) _weekOffset = (_weekOffset + dir).clamp(0, _historyDays ~/ 7 - 1);
      });

  String get _periodTitle {
    final today = _today;
    switch (_mode) {
      case _UsageMode.daily:
        return _dateText(today.subtract(Duration(days: _dayOffset)));
      case _UsageMode.weekly:
        final j = Jalali.fromDateTime(today);
        final start = today.subtract(Duration(days: j.weekDay - 1 + _weekOffset * 7));
        final a = Jalali.fromDateTime(start);
        final b = Jalali.fromDateTime(start.add(const Duration(days: 6)));
        return '${a.day.toPersian()} ${a.formatter.mN} تا ${b.day.toPersian()} ${b.formatter.mN} ${b.year.toPersian()}';
      case _UsageMode.monthly:
        final j = Jalali.fromDateTime(today);
        return '${j.formatter.mN} ${j.year.toPersian()} و روزهای اطراف (برای دیدن بقیه‌ی روزها بکشید)';
    }
  }

  Widget _modeChips() {
    const labels = {_UsageMode.daily: 'روزانه', _UsageMode.weekly: 'هفتگی', _UsageMode.monthly: 'ماهانه'};
    return Row(
      children: [
        for (final entry in labels.entries) ...[
          GestureDetector(
            onTap: () => _setMode(entry.key),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: _mode == entry.key ? const Color(0xFF9292E2) : const Color(0xFF2E2D4A),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(entry.value, style: AppTypography.caption.copyWith(color: _mode == entry.key ? Colors.white : const Color(0xFF9D99B8))),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ],
    );
  }

  Widget _chart(_Series s) {
    final maxV = s.values.fold<double>(0, (a, b) => b > a ? b : a);
    Widget slot(int i, double width) {
      final v = s.values[i];
      final h = v <= 0 || maxV <= 0 ? 3.0 : (v / maxV * 70).clamp(4.0, 70.0);
      final isToday = i == s.today;
      final picked = _picked == i;
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _picked = picked ? null : i),
        child: SizedBox(
          width: width,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: 74,
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    width: width * 0.56,
                    height: h,
                    decoration: BoxDecoration(
                      color: s.future[i]
                          ? Colors.transparent
                          : (v > 0 ? (picked ? const Color(0xFFE5A66B) : const Color(0xFF9292E2)) : const Color(0xFF2E2D4A)),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                s.labels[i],
                maxLines: 1,
                overflow: TextOverflow.visible,
                softWrap: false,
                style: AppTypography.caption.copyWith(fontSize: 9, color: isToday ? const Color(0xFFFFD580) : const Color(0xFF9D99B8), fontWeight: isToday ? FontWeight.bold : FontWeight.normal),
              ),
            ],
          ),
        ),
      );
    }

    return LayoutBuilder(builder: (context, c) {
      if (_mode != _UsageMode.monthly) {
        final w = c.maxWidth / s.values.length;
        return Row(children: [for (int i = 0; i < s.values.length; i++) slot(i, w)]);
      }
      // 21 days fit the width (10 before, today, 10 after); the rest is reached by scrolling
      final w = c.maxWidth / (_monthAfter * 2 + 1);
      if (!_scrolledToToday) {
        _scrolledToToday = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_scroll.hasClients) return;
          final target = ((s.today - _monthAfter) * w).clamp(0.0, _scroll.position.maxScrollExtent);
          _scroll.jumpTo(target);
        });
      }
      return SingleChildScrollView(
        controller: _scroll,
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(children: [for (int i = 0; i < s.values.length; i++) slot(i, w)]),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = _series();
    final total = s.values.fold<double>(0, (a, b) => a + b);
    final active = s.values.where((v) => v > 0).length;
    final peak = s.values.fold<double>(0, (a, b) => b > a ? b : a);
    final picked = _picked != null && _picked! < s.values.length ? _picked! : null;

    final stats = _mode == _UsageMode.daily
        ? [('مجموع روز', total == 0 ? '—' : _fmt(total)), ('ساعت‌های فعال', active.toPersian()), ('بیشترین در یک ساعت', peak == 0 ? '—' : _fmt(peak))]
        : [
            (_mode == _UsageMode.weekly ? 'مجموع هفته' : 'مجموع بازه', total == 0 ? '—' : _fmt(total)),
            ('روزهای فعال', active.toPersian()),
            ('میانگین هر روز فعال', active == 0 ? '—' : _fmt(total / active)),
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('زمان حضور در اپلیکیشن', style: AppTypography.h3.copyWith(color: const Color(0xFFFFD580))),
        const SizedBox(height: 10),
        _modeChips(),
        const SizedBox(height: 10),
        Row(
          children: [
            if (_mode != _UsageMode.monthly)
              GestureDetector(
                onTap: _canGoOlder ? () => _step(1) : null,
                child: Icon(Icons.chevron_right_rounded, color: _canGoOlder ? const Color(0xFFDDD9EE) : const Color(0xFF4C4A6E)),
              ),
            Expanded(child: Text(_periodTitle, textAlign: TextAlign.center, style: AppTypography.captionMuted)),
            if (_mode != _UsageMode.monthly)
              GestureDetector(
                onTap: _canGoNewer ? () => _step(-1) : null,
                child: Icon(Icons.chevron_left_rounded, color: _canGoNewer ? const Color(0xFFDDD9EE) : const Color(0xFF4C4A6E)),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (!widget.loaded)
          const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Color(0xFFDFB690))))
        else if (!widget.hasData)
          Text('اطلاعاتی دریافت نشد', style: AppTypography.captionMuted)
        else ...[
          Directionality(textDirection: TextDirection.rtl, child: _chart(s)),
          const SizedBox(height: 8),
          SizedBox(
            height: 18,
            child: Center(
              child: Text(
                picked == null ? 'برای دیدن مقدار هر ستون، آن را لمس کنید' : '${s.captions[picked]}: ${s.values[picked] > 0 ? _fmt(s.values[picked]) : 'بدون حضور'}',
                style: AppTypography.captionMuted,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [for (final st in stats) ReportActivityCards._statBox(st.$1, st.$2)],
          ),
          if (_days.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('هنوز زمانی ثبت نشده است. زمان حضور از نسخهٔ جدید اپ به بعد ثبت می‌شود.', style: AppTypography.captionMuted),
            ),
        ],
      ],
    );
  }
}
