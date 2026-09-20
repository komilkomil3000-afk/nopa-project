import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../services/api_service.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';

enum EventType { mediaClass, skillClass, overdue, assignment }
typedef CalendarEventType = EventType;

class CalendarEvent {
  final int year;
  final int month;
  final int day;
  final EventType type;
  final String title;
  final String time;
  final String? instructor;
  final String? id;

  CalendarEvent({
    required this.year,
    required this.month,
    required this.day,
    required this.type,
    required this.title,
    required this.time,
    this.instructor,
    this.id,
  });
}

class EducationCalendar extends StatefulWidget {
  const EducationCalendar({super.key});

  @override
  State<EducationCalendar> createState() => _EducationCalendarState();
}

class _EducationCalendarState extends State<EducationCalendar> {
  late int _selectedYear;
  late int _selectedMonth;
  late int _selectedDay;

  late final ScrollController _daysScrollController;
  List<CalendarEvent> _events = [];
  bool _isLoading = true;

  static const List<String> _jalaliMonthNames = [
    "",
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];

  static const List<String> _persianWeekDays = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
  ];

  @override
  void initState() {
    super.initState();
    _daysScrollController = ScrollController();

    // Default to active curriculum semester (Mehr 1405) or current Jalali date
    final now = Jalali.now();
    final int initialYear = now.year >= 1403 ? now.year : 1405;
    final int initialMonth = 7; // Mehr
    final int initialDay = 7;

    _selectedYear = initialYear;
    _selectedMonth = initialMonth;
    _selectedDay = initialDay;

    _fetchEvents();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToSelectedDay(animate: false);
    });
  }

  @override
  void dispose() {
    _daysScrollController.dispose();
    super.dispose();
  }

  void _scrollToSelectedDay({bool animate = true}) {
    if (!_daysScrollController.hasClients) return;
    const double itemWidth = 56.0; // width (48) + margin/spacing (8)
    final double screenWidth = MediaQuery.of(context).size.width;
    // Day item N (1-indexed) center position in horizontal list with padding 16.0
    final double itemCenter = 16.0 + ((_selectedDay - 1) * itemWidth) + 24.0;
    final double targetOffset = itemCenter - (screenWidth / 2);
    final double maxScroll = _daysScrollController.position.maxScrollExtent;
    final double clampedOffset = targetOffset.clamp(0.0, maxScroll > 0 ? maxScroll : 0.0);

    if (animate) {
      _daysScrollController.animateTo(
        clampedOffset,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    } else {
      _daysScrollController.jumpTo(clampedOffset);
    }
  }

  Future<void> _fetchEvents() async {
    try {
      final data = await HttpApiService().getCalendarEvents();
      final List<CalendarEvent> loadedEvents = [];

      if (data != null && data['events'] != null) {
        for (var e in data['events']) {
          EventType type = EventType.skillClass;
          final String rawType = e['type']?.toString() ?? '';
          if (rawType == 'mediaClass' || rawType.contains('media')) {
            type = EventType.mediaClass;
          } else if (rawType == 'overdue' || rawType == 'missed') {
            type = EventType.overdue;
          } else if (rawType == 'assignment' || rawType == 'challenge') {
            type = EventType.overdue;
          }

          int evYear = _selectedYear;
          int evMonth = _selectedMonth;
          int evDay = 1;

          try {
            if (e['jalaliDate'] != null && e['jalaliDate'].toString().contains('/')) {
              final parts = e['jalaliDate'].toString().split('/');
              if (parts.length == 3) {
                evYear = int.parse(parts[0]);
                evMonth = int.parse(parts[1]);
                evDay = int.parse(parts[2]);
              }
            } else if (e['year'] != null && e['month'] != null && e['day'] != null) {
              evYear = e['year'] is int ? e['year'] : int.parse(e['year'].toString());
              evMonth = e['month'] is int ? e['month'] : int.parse(e['month'].toString());
              evDay = e['day'] is int ? e['day'] : int.parse(e['day'].toString());
            }
          } catch (_) {
            evDay = e['day'] ?? 1;
          }

          loadedEvents.add(CalendarEvent(
            year: evYear,
            month: evMonth,
            day: evDay,
            type: type,
            title: e['title'] ?? 'کلاس آموزشی',
            time: e['time'] ?? 'ساعت ۱۸:۰۰',
            instructor: e['instructor'],
            id: e['id']?.toString(),
          ));
        }
      }

      // Master Curriculum Schedule strictly synchronized with CRM Database (Sheet 03 & Sheet 05)
      final List<CalendarEvent> masterCurriculum = [
        // =====================================================================
        // مهرماه (Month 7) - منزلگاه اول (شوک و اینشات) و منزلگاه دوم (خودشناسی و آدیشن)
        // =====================================================================
        CalendarEvent(year: _selectedYear, month: 7, day: 2, type: EventType.mediaClass, title: 'آشنایی با محیط اینشات', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 3, type: EventType.mediaClass, title: 'برش، ویرایش و موسیقی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 5, type: EventType.skillClass, title: 'تعریف شوک و انواع آن', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیراینه‌گر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 6, type: EventType.skillClass, title: 'خودشناسی: مفاهیم پایه', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 7, type: EventType.skillClass, title: 'راهکارهای تغییر نگرش', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیراینه‌گر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 8, type: EventType.skillClass, title: 'نقاط قوت و ضعف', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 9, type: EventType.mediaClass, title: 'آشنایی با نرم‌افزار آدیشن', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 10, type: EventType.mediaClass, title: 'ویرایش و برش صدا در آدیشن', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 13, type: EventType.skillClass, title: 'ارزش‌ها و باورها', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 15, type: EventType.skillClass, title: 'هدف‌گذاری در خودشناسی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 16, type: EventType.mediaClass, title: 'افکت‌ها و فیلترهای صوتی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 17, type: EventType.mediaClass, title: 'مولتی‌ترک و میکس اولیه', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 20, type: EventType.skillClass, title: 'مدیریت هیجانات', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 20, type: EventType.overdue, title: 'چالش ۳۰۱', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 22, type: EventType.skillClass, title: 'ارتباط مؤثر با خود و دیگران', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 22, type: EventType.overdue, title: 'چالش ۳۰۲', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 23, type: EventType.mediaClass, title: 'تکنیک‌های پیشرفته ضبط', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 24, type: EventType.mediaClass, title: 'مسترینگ و آماده‌سازی نهایی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 24, type: EventType.overdue, title: 'چالش ۴۰۱', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 26, type: EventType.overdue, title: 'چالش ۴۰۲', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 27, type: EventType.skillClass, title: 'مدیریت زمان و انرژی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 28, type: EventType.overdue, title: 'چالش ۵۰۱', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 29, type: EventType.skillClass, title: 'خودشناسی و سبک زندگی سالم', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش'),
        CalendarEvent(year: _selectedYear, month: 7, day: 30, type: EventType.mediaClass, title: 'تولید پادکست حرفه‌ای (بخش اول)', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),
        CalendarEvent(year: _selectedYear, month: 7, day: 30, type: EventType.overdue, title: 'چالش ۵۰۲', time: 'مهلت تحویل تا ۲۳:۵۹'),
        CalendarEvent(year: _selectedYear, month: 7, day: 31, type: EventType.mediaClass, title: 'تولید پادکست حرفه‌ای (بخش دوم و انتشار)', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر'),

        // =====================================================================
        // آبان‌ماه (Month 8) - منزلگاه سوم (همراهان و کنوا)
        // =====================================================================
        CalendarEvent(year: _selectedYear, month: 8, day: 3, type: EventType.skillClass, title: 'تعریف همراهان و دشمنان', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 5, type: EventType.skillClass, title: 'تأثیر دوستان و همکاران', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 6, type: EventType.mediaClass, title: 'آشنایی با اپلیکیشن کنوا', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 8, day: 7, type: EventType.mediaClass, title: 'کار با قالب‌ها و المان‌ها', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 8, day: 10, type: EventType.skillClass, title: 'شناخت مخالفان و رقبا', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 12, type: EventType.skillClass, title: 'راهکارهای عملی در تعاملات', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 13, type: EventType.mediaClass, title: 'طراحی پوستر و اینفوگرافی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 8, day: 14, type: EventType.mediaClass, title: 'ویدئو و انیمیشن در کنوا', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 8, day: 17, type: EventType.skillClass, title: 'رهبری و همراهی در تیم', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 19, type: EventType.skillClass, title: 'پایداری در مسیر همراهی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان'),
        CalendarEvent(year: _selectedYear, month: 8, day: 20, type: EventType.mediaClass, title: 'طراحی محتوا برای شبکه‌های اجتماعی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 8, day: 21, type: EventType.mediaClass, title: 'پروژه نهایی و جمع‌بندی کنوا', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),

        // =====================================================================
        // آذرماه (Month 9) - منزلگاه چهارم (هستی‌شناسی و کنوا پیشرفته) و منزلگاه پنجم (هدف‌گذاری و فتوشاپ)
        // =====================================================================
        CalendarEvent(year: _selectedYear, month: 9, day: 1, type: EventType.skillClass, title: 'مفاهیم هستی‌شناسی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا'),
        CalendarEvent(year: _selectedYear, month: 9, day: 3, type: EventType.skillClass, title: 'شناخت خدا در هستی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا'),
        CalendarEvent(year: _selectedYear, month: 9, day: 4, type: EventType.mediaClass, title: 'کنوا پیشرفته: تکنیک‌های حرفه‌ای', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 9, day: 5, type: EventType.mediaClass, title: 'طراحی هویت بصری کامل', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 9, day: 8, type: EventType.skillClass, title: 'شناخت ولی و امامت', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا'),
        CalendarEvent(year: _selectedYear, month: 9, day: 10, type: EventType.skillClass, title: 'تأثیر شناخت هستی و ولی در زندگی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا'),
        CalendarEvent(year: _selectedYear, month: 9, day: 11, type: EventType.mediaClass, title: 'انیمیشن و موشن گرافیک پیشرفته', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 9, day: 12, type: EventType.mediaClass, title: 'پروژه نهایی: کمپین تبلیغاتی کامل', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری'),
        CalendarEvent(year: _selectedYear, month: 9, day: 15, type: EventType.skillClass, title: 'مبانی هدف‌گذاری', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم'),
        CalendarEvent(year: _selectedYear, month: 9, day: 16, type: EventType.skillClass, title: 'هدف‌گذاری هوشمند (SMART)', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم'),
        CalendarEvent(year: _selectedYear, month: 9, day: 17, type: EventType.skillClass, title: 'برنامه‌ریزی عملیاتی', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم'),
        CalendarEvent(year: _selectedYear, month: 9, day: 18, type: EventType.mediaClass, title: 'آشنایی با فتوشاپ و محیط کار', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی'),
        CalendarEvent(year: _selectedYear, month: 9, day: 19, type: EventType.mediaClass, title: 'ابزارهای انتخاب و برش', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی'),
        CalendarEvent(year: _selectedYear, month: 9, day: 22, type: EventType.skillClass, title: 'انگیزه و پایداری', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم'),
        CalendarEvent(year: _selectedYear, month: 9, day: 22, type: EventType.mediaClass, title: 'لایه‌ها و ماسک‌ها', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی'),
        CalendarEvent(year: _selectedYear, month: 9, day: 23, type: EventType.mediaClass, title: 'رنگ و تنظیمات نور', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی'),
        CalendarEvent(year: _selectedYear, month: 9, day: 24, type: EventType.skillClass, title: 'ارزیابی و بازنگری اهداف', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم'),
        CalendarEvent(year: _selectedYear, month: 9, day: 24, type: EventType.mediaClass, title: 'پروژه نهایی و خروجی', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی'),
      ];

      // Merge loaded backend events with master curriculum
      for (var ev in masterCurriculum) {
        final exists = loadedEvents.any((e) =>
            e.year == ev.year &&
            e.month == ev.month &&
            e.day == ev.day &&
            e.type == ev.type &&
            e.title == ev.title);
        if (!exists) {
          loadedEvents.add(ev);
        }
      }

      if (mounted) {
        setState(() {
          _events = loadedEvents;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _goToPreviousMonth() {
    setState(() {
      int newMonth = _selectedMonth - 1;
      int newYear = _selectedYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
      _selectedYear = newYear;
      _selectedMonth = newMonth;
      final int maxDays = Jalali(_selectedYear, _selectedMonth, 1).monthLength;
      if (_selectedDay > maxDays) {
        _selectedDay = maxDays;
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToSelectedDay(animate: true));
  }

  void _goToNextMonth() {
    setState(() {
      int newMonth = _selectedMonth + 1;
      int newYear = _selectedYear;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      _selectedYear = newYear;
      _selectedMonth = newMonth;
      final int maxDays = Jalali(_selectedYear, _selectedMonth, 1).monthLength;
      if (_selectedDay > maxDays) {
        _selectedDay = maxDays;
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToSelectedDay(animate: true));
  }

  String _getPreviousMonthName() {
    final int prevMonth = _selectedMonth == 1 ? 12 : _selectedMonth - 1;
    return _jalaliMonthNames[prevMonth];
  }

  String _getNextMonthName() {
    final int nextMonth = _selectedMonth == 12 ? 1 : _selectedMonth + 1;
    return _jalaliMonthNames[nextMonth];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: CircularProgressIndicator(color: Color(0xFFCD8449)),
        ),
      );
    }

    final String currentMonthName = (_selectedMonth >= 1 && _selectedMonth <= 12)
        ? _jalaliMonthNames[_selectedMonth]
        : 'مهر';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Section Title: "زمان"
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.0),
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(
                'روزمان',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // 2. Month Selector Row matching exact user screenshot:
          // Left: < آبان  |  Center: مهرماه  |  Right: شهریور >
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0),
            child: Directionality(
              textDirection: TextDirection.ltr, // LTR structure: [Left: < آبان] [Center: مهرماه] [Right: شهریور >]
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Left Side: Next Month (< آبان)
                  GestureDetector(
                    onTap: _goToNextMonth,
                    behavior: HitTestBehavior.opaque,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.chevron_left_rounded,
                          color: Color(0xFFDEB58A),
                          size: 22,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          _getNextMonthName(),
                          style: const TextStyle(
                            color: Color(0xFF9E9CEB),
                            fontSize: 15.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Center: Current Month Title (مهرماه)
                  Text(
                    currentMonthName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 23,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),

                  // Right Side: Previous Month (شهریور >)
                  GestureDetector(
                    onTap: _goToPreviousMonth,
                    behavior: HitTestBehavior.opaque,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _getPreviousMonthName(),
                          style: const TextStyle(
                            color: Color(0xFF9E9CEB),
                            fontSize: 15.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                        const SizedBox(width: 3),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: Color(0xFFDEB58A),
                          size: 22,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // 3. Scrollable Month Days Strip (Scrollable left/right through all days of the month)
          _buildMonthDaysStrip(),

          const SizedBox(height: 16),

          // 4. Bottom 3-Column Class Details Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18.0),
            child: _buildClassesSummaryCard(),
          ),
        ],
      ),
    );
  }

  /// Builds horizontally scrollable day cards for the entire current Persian month (1 to 30/31)
  Widget _buildMonthDaysStrip() {
    final int daysInMonth = Jalali(_selectedYear, _selectedMonth, 1).monthLength;

    return SizedBox(
      height: 94,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: ListView.separated(
          controller: _daysScrollController,
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: daysInMonth,
          separatorBuilder: (context, index) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            final int dayNum = index + 1;
            final Jalali dayJalali = Jalali(_selectedYear, _selectedMonth, dayNum);
            final int weekDayIdx = (dayJalali.weekDay - 1) % 7;
            final String weekDayName = _persianWeekDays[weekDayIdx];

            final bool isSelected = (_selectedYear == dayJalali.year &&
                _selectedMonth == dayJalali.month &&
                _selectedDay == dayNum);

            final dayEvents = _events.where((e) =>
                e.year == dayJalali.year &&
                e.month == dayJalali.month &&
                e.day == dayNum).toList();

            final bool hasMedia = dayEvents.any((e) => e.type == EventType.mediaClass);
            final bool hasSkill = dayEvents.any((e) => e.type == EventType.skillClass);
            final bool hasOverdue = dayEvents.any((e) => e.type == EventType.overdue);

            return _buildDayCard(
              dayNum: dayNum,
              weekDayName: weekDayName,
              isSelected: isSelected,
              hasMedia: hasMedia,
              hasSkill: hasSkill,
              hasOverdue: hasOverdue,
              onTap: () {
                setState(() {
                  _selectedDay = dayNum;
                });
                _scrollToSelectedDay(animate: true);
              },
            );
          },
        ),
      ),
    );
  }

  /// Individual Day Pill Card matching screenshot design
  Widget _buildDayCard({
    required int dayNum,
    required String weekDayName,
    required bool isSelected,
    required bool hasMedia,
    required bool hasSkill,
    required bool hasOverdue,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 92,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: isSelected
              ? const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFE5A86D),
                    Color(0xFFA86C38),
                  ],
                )
              : const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF6C6BC2),
                    Color(0xFF3B396E),
                  ],
                ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(1.2), // Gradient border matching StationCard & Asset pills
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18.8),
            gradient: isSelected
                ? const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFFDE9959),
                      Color(0xFFB87239),
                    ],
                  )
                : const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFF383768),
                      Color(0xFF2C2B54),
                    ],
                  ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 1. Day Number on Top
              Text(
                '$dayNum',
                style: TextStyle(
                  color: isSelected ? Colors.white : const Color(0xFFB8B7DF),
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              const SizedBox(height: 2),

              // 2. Weekday Name
              Text(
                weekDayName,
                style: TextStyle(
                  color: isSelected ? const Color(0xFF5A3114) : const Color(0xFF9897D2),
                  fontSize: 10.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              const SizedBox(height: 4),

              // 3. Indicator Dot(s)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (hasMedia)
                    Container(
                      width: 5.5,
                      height: 5.5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: const BoxDecoration(
                        color: Color(0xFF38CCD6), // Cyan dot
                        shape: BoxShape.circle,
                      ),
                    ),
                  if (hasSkill)
                    Container(
                      width: 5.5,
                      height: 5.5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF9E872), // Yellow dot
                        shape: BoxShape.circle,
                      ),
                    ),
                  if (hasOverdue)
                    Container(
                      width: 5.5,
                      height: 5.5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF67575), // Coral red dot
                        shape: BoxShape.circle,
                      ),
                    ),
                  if (!hasMedia && !hasSkill && !hasOverdue)
                    const SizedBox(height: 5.5),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Bottom 3-Column Class Details Card matching exact login box stroke and color styling
  Widget _buildClassesSummaryCard() {
    final dayEvents = _events.where((e) =>
        e.year == _selectedYear &&
        e.month == _selectedMonth &&
        e.day == _selectedDay).toList();

    final mediaEvents = dayEvents.where((e) => e.type == EventType.mediaClass).toList();
    final skillEvents = dayEvents.where((e) => e.type == EventType.skillClass).toList();
    final overdueEvents = dayEvents.where((e) => e.type == EventType.overdue).toList();

    final String mediaText = mediaEvents.isNotEmpty ? mediaEvents.map((e) => e.title).join('، ') : '-';
    final String skillText = skillEvents.isNotEmpty ? skillEvents.map((e) => e.title).join('، ') : '-';
    final String overdueText = overdueEvents.isNotEmpty ? overdueEvents.map((e) => e.title).join('، ') : '-';

    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Column(
          children: [
            // 3 Column Headers (Right: کلاس‌های رسانه‌ای • | Middle: کلاس‌های مهارتی • | Left: معوقه •)
            Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                children: [
                  // Right Column Header: کلاس‌های رسانه‌ای (Cyan)
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            color: Color(0xFF4DE2EC),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'رسانه‌ای',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFF4DE2EC),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Middle Column Header: مهارتی (Yellow)
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF9E872),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'مهارتی',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFFF9E872),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Left Column Header: معوقه (Coral Red)
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF67575),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'معوقه',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFFF67575),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8),
            Divider(
              color: Colors.white.withValues(alpha: 0.08),
              height: 1,
              thickness: 1,
            ),
            const SizedBox(height: 10),

            // 3 Column Values Row
            Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Right Column Value
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.0),
                      child: Text(
                        mediaText,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: mediaText == '-' ? const Color(0xFF6E6C88) : const Color(0xFFA5A3BE),
                          fontSize: 11.5,
                          height: 1.3,
                          fontWeight: FontWeight.w400,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ),

                  // Middle Column Value
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.0),
                      child: Text(
                        skillText,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: skillText == '-' ? const Color(0xFF6E6C88) : const Color(0xFFA5A3BE),
                          fontSize: 11.5,
                          height: 1.3,
                          fontWeight: FontWeight.w400,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ),

                  // Left Column Value
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.0),
                      child: Text(
                        overdueText,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: overdueText == '-' ? const Color(0xFF6E6C88) : const Color(0xFFA5A3BE),
                          fontSize: 11.5,
                          height: 1.3,
                          fontWeight: FontWeight.w400,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}