import 'package:shamsi_date/shamsi_date.dart';

/// Time rules shared by the calendar and the class screens, so both open a class at the same moment.
/// Class dates are Jalali strings ("1405/07/02") and times Persian intervals ("۱۸:۰۰ الی ۱۹:۳۰"); they are
/// Iran local time (UTC+3:30, no daylight saving).
class ScheduleUtils {
  static const Duration _iranOffset = Duration(hours: 3, minutes: 30);

  static const List<String> _monthNames = [
    '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];

  static String _latinDigits(String input) {
    final buffer = StringBuffer();
    for (final unit in input.codeUnits) {
      if (unit >= 0x06F0 && unit <= 0x06F9) {
        buffer.writeCharCode(unit - 0x06F0 + 48);
      } else if (unit >= 0x0660 && unit <= 0x0669) {
        buffer.writeCharCode(unit - 0x0660 + 48);
      } else {
        buffer.writeCharCode(unit);
      }
    }
    return buffer.toString();
  }

  /// The moment (as a UTC instant) a class starts: its Jalali [date] plus the first hour of [time].
  /// Without a time the class opens at the start of that day. Null when the date cannot be read.
  static DateTime? startInstant(String? date, String? time) {
    if (date == null || date.trim().isEmpty) return null;
    final parts = _latinDigits(date).trim().split(RegExp(r'[/\-]'));
    if (parts.length != 3) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null || m < 1 || m > 12 || d < 1 || d > 31) return null;

    int hour = 0;
    int minute = 0;
    if (time != null) {
      final match = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(_latinDigits(time));
      if (match != null) {
        hour = int.parse(match.group(1)!);
        minute = int.parse(match.group(2)!);
      }
    }

    try {
      final g = Jalali(y, m, d).toGregorian();
      return DateTime.utc(g.year, g.month, g.day, hour, minute).subtract(_iranOffset);
    } catch (_) {
      return null;
    }
  }

  /// When a session opens: its date and time, or null when it has none.
  static DateTime? sessionStart(Map<String, dynamic> session) {
    return startInstant(
      (session['sessionDate'] ?? session['jalaliDate'])?.toString(),
      (session['sessionTime'] ?? session['time'])?.toString(),
    );
  }

  /// When a clip opens, from the admin's scheduled unlock time.
  static DateTime? clipUnlockInstant(Map<String, dynamic> clip) {
    final raw = clip['scheduledUnlockTime'];
    if (raw == null) return null;
    final parsed = DateTime.tryParse(raw.toString());
    return parsed?.toUtc();
  }

  static bool hasStarted(DateTime? start) => start == null || !DateTime.now().toUtc().isBefore(start);

  /// "یکشنبه ۷ مهر، ساعت ۱۶:۰۰" for an instant, in Iran time.
  static String describe(DateTime instant) {
    final local = instant.toUtc().add(_iranOffset);
    final j = Gregorian(local.year, local.month, local.day).toJalali();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '${_persian('${j.day}')} ${_monthNames[j.month]}، ساعت ${_persian('$hh:$mm')}';
  }

  static String _persian(String input) {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return input.split('').map((c) {
      final code = c.codeUnitAt(0);
      return (code >= 48 && code <= 57) ? digits[code - 48] : c;
    }).join();
  }

  /// "۱۴۰۵/۰۸/۰۹ - ۱۸:۳۰" for an ISO timestamp, in Iran time; null when it cannot be read.
  static String? formatDateTime(String? iso) {
    if (iso == null) return null;
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return null;
    final local = parsed.toUtc().add(_iranOffset);
    final j = Gregorian(local.year, local.month, local.day).toJalali();
    String two(int n) => n.toString().padLeft(2, '0');
    return _persian('${j.year}/${two(j.month)}/${two(j.day)} - ${two(local.hour)}:${two(local.minute)}');
  }

  /// Today in the Iranian calendar, from the device clock converted to Iran time.
  static Jalali todayJalali() {
    final local = DateTime.now().toUtc().add(_iranOffset);
    return Gregorian(local.year, local.month, local.day).toJalali();
  }
}
