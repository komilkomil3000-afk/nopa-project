import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../core/schedule_utils.dart';
import '../core/station_categories.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';
import 'app_toast.dart';
import '../services/api_service.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';

enum EventType { mediaClass, skillClass, overdue, assignment }

class CalendarEvent {
  final int year;
  final int month;
  final int day;
  final EventType type;
  final String title;
  final String time;
  final String? instructor;
  final String? id;
  final String? stationId;
  /// Position of the event's class category in its station (admin-panel order); -1 for non-class events.
  final int categoryIndex;
  /// Title of the class category as defined in the admin panel.
  final String? categoryTitle;
  final String? categoryId;

  bool get isClass => type == EventType.skillClass || type == EventType.mediaClass;

  CalendarEvent({
    required this.year,
    required this.month,
    required this.day,
    required this.type,
    required this.title,
    required this.time,
    this.instructor,
    this.id,
    this.stationId,
    this.categoryIndex = -1,
    this.categoryTitle,
    this.categoryId,
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

    // Opens on today's date in the Iranian calendar
    final today = ScheduleUtils.todayJalali();
    _selectedYear = today.year;
    _selectedMonth = today.month;
    _selectedDay = today.day;

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
            time: e['time']?.toString() ?? '',
            instructor: e['instructor'],
            id: e['id']?.toString(),
            stationId: e['stationId']?.toString(),
            // Older servers send only the type: skillClass = first category, mediaClass = second
            categoryIndex: (type == EventType.skillClass || type == EventType.mediaClass)
                ? ((e['categoryIndex'] as num?)?.toInt() ?? (type == EventType.mediaClass ? 1 : 0))
                : -1,
            categoryTitle: e['categoryTitle']?.toString(),
            categoryId: e['categoryId']?.toString(),
          ));
        }
      }

      if (mounted) {
        setState(() {
          _events = loadedEvents;
          _isLoading = false;
        });
        // The days strip only exists now: bring today into view
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToSelectedDay(animate: false));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToSelectedDay(animate: false));
      }
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
                  fontSize: 14.5,
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
                  // Left Side: Previous Month (< شهریور)
                  Expanded(child: Align(alignment: Alignment.centerLeft, child: TapExpander(child: GestureDetector(
                    onTap: _goToPreviousMonth,
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
                          _getPreviousMonthName(),
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
                  )))),

                  // Center: Current Month Title (مهرماه) — centered on the full screen width
                  // because both side slots are Expanded and therefore equally wide
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

                  // Right Side: Next Month (آبان >)
                  Expanded(child: Align(alignment: Alignment.centerRight, child: TapExpander(child: GestureDetector(
                    onTap: _goToNextMonth,
                    behavior: HitTestBehavior.opaque,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
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
                        const SizedBox(width: 3),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: Color(0xFFDEB58A),
                          size: 22,
                        ),
                      ],
                    ),
                  )))),
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

            final today = ScheduleUtils.todayJalali();
            final bool isToday = today.year == dayJalali.year && today.month == dayJalali.month && today.day == dayNum;
            final bool isSelected = (_selectedYear == dayJalali.year &&
                _selectedMonth == dayJalali.month &&
                _selectedDay == dayNum);

            final dayEvents = _events.where((e) =>
                e.year == dayJalali.year &&
                e.month == dayJalali.month &&
                e.day == dayNum).toList();

            final List<int> classCategories =
                (dayEvents.where((e) => e.isClass).map((e) => e.categoryIndex).toSet().toList()..sort());
            final bool hasOverdue = dayEvents.any((e) => e.type == EventType.overdue);

            return _buildDayCard(
              dayNum: dayNum,
              weekDayName: weekDayName,
              isSelected: isSelected,
              isToday: isToday,
              classCategories: classCategories,
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
    required bool isToday,
    required List<int> classCategories,
    required bool hasOverdue,
    required VoidCallback onTap,
  }) {
    return TapExpander(child: GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 92,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: isToday && !isSelected ? Border.all(color: const Color(0xFFE5A86D), width: 1.6) : null,
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
                '$dayNum'.toPersianDigits(),
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
                  fontSize: 8.5,
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
                  // One dot per class category that has a class this day (category colours as in the card below)
                  for (final ci in classCategories)
                    Container(
                      width: 5.5,
                      height: 5.5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: _categoryColor(ci),
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
                  if (classCategories.isEmpty && !hasOverdue)
                    const SizedBox(height: 5.5),
                ],
              ),
            ],
          ),
        ),
      ),
    ));
  }

  /// Bottom 2-Column Class Details Card: Right is Skill Classes, Left is Media Classes (Overdue removed)
  Future<void> _navigateToClass(CalendarEvent event) async {
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    final bool isMentor = user.role.isMentorLike;

    // A class that has not started yet only shows when it opens
    if (!isMentor) {
      final start = ScheduleUtils.startInstant('${event.year}/${event.month}/${event.day}', event.time);
      if (!ScheduleUtils.hasStarted(start)) {
        AppToast.info(context, 'این کلاس هنوز باز نشده است و ${ScheduleUtils.describe(start!)} باز می‌شود.');
        return;
      }
    }

    final int tab = event.categoryIndex < 0 ? 0 : event.categoryIndex;
    final stations = await HttpApiService().getStations();
    if (!mounted) return;

    int stationIndex = stations.indexWhere((st) => st['id']?.toString() == event.stationId);
    if (stationIndex < 0) stationIndex = 0;

    if (!isMentor && stationIndex < stations.length) {
      final int level = user.levelFrame < 1 ? 1 : user.levelFrame;
      final bool progressLocked =
          stationIndex > 0 && (stationIndex + 1) > level && stationIndex > user.completedStationsCount;
      if (progressLocked || stations[stationIndex]['isLocked'] == true) {
        AppToast.info(context, 'منزلگاه این کلاس هنوز باز نشده است.');
        return;
      }
    }

    // The earlier sessions of the same class type must be done first: the class is not even opened
    if (stationIndex < stations.length && event.id != null) {
      final progress = await HttpApiService().getUserProgress();
      final answers = await HttpApiService().getMyQuizAnswers();
      if (!mounted) return;
      if (_hasUnfinishedEarlierSession(stations[stationIndex], event.id!, progress, answers)) {
        AppToast.info(context, 'این جلسه قفل است. ابتدا جلسه‌های قبلی را ببینید و به آزمون‌هایشان پاسخ دهید.');
        return;
      }
    }

    Navigator.pushNamed(
      context,
      AppRoutes.class2,
      arguments: {
        'stationIndex': stationIndex,
        'initialTab': tab,
        'tab': tab,
        'categoryIndex': tab,
        if (event.categoryId != null) 'categoryId': event.categoryId,
        if (event.id != null) 'sessionId': event.id,
        'sessionTitle': event.title,
        'title': event.title,
        'instructor': event.instructor,
      },
    );
  }

  /// True when a session before [sessionId] in the same class type (skill / media) still has a part
  /// that was neither watched nor answered, the same rule the class screen uses to lock a session.
  bool _hasUnfinishedEarlierSession(
    Map<String, dynamic> station,
    String sessionId,
    List<dynamic> progress,
    List<Map<String, dynamic>> answers,
  ) {
    bool clipDone(String sessionId, String clipId, int clipIndex) {
      final watched = progress.any((p) =>
          p is Map && p['clipId']?.toString() == clipId && (p['isWatched'] == true || p['quizPassed'] == true));
      if (watched) return true;
      return answers.any((a) {
        if (a['sessionId']?.toString() != sessionId) return false;
        final answeredClip = a['clipId']?.toString();
        if (answeredClip != null && answeredClip.isNotEmpty) return answeredClip == clipId;
        return a['partIndex'] == clipIndex;
      });
    }

    for (final cat in (station['categories'] as List? ?? []).whereType<Map>()) {
      final sessions = (cat['sessions'] as List? ?? []).whereType<Map>().where((s) => s['isDeleted'] != true).toList();
      final index = sessions.indexWhere((s) => s['id']?.toString() == sessionId);
      if (index < 0) continue;
      for (int i = 0; i < index; i++) {
        final id = sessions[i]['id']?.toString() ?? '';
        final clips = (sessions[i]['videoClips'] as List? ?? []).whereType<Map>().toList();
        for (int c = 0; c < clips.length; c++) {
          if (!clipDone(id, clips[c]['id']?.toString() ?? '', c)) return true;
        }
      }
      return false;
    }
    return false;
  }

  Widget _buildEventColumnList({
    required List<CalendarEvent> events,
    required Color accentColor,
  }) {
    if (events.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 4.0),
        child: Text(
          '-',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF6E6C88),
            fontSize: 12,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      );
    }


    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: events.map((event) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 3.0),
          child: Material(
            color: Colors.transparent,
            child: TapExpander(child: InkWell(
              onTap: () => _navigateToClass(event),
              borderRadius: BorderRadius.circular(8),
              splashColor: accentColor.withValues(alpha: 0.15),
              highlightColor: accentColor.withValues(alpha: 0.08),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 5.0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: accentColor.withValues(alpha: 0.08),
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.25),
                    width: 0.8,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        event.title,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFE5E2F8),
                          fontSize: 11.5,
                          height: 1.3,
                          fontWeight: FontWeight.w500,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.play_circle_outline_rounded,
                      size: 13,
                      color: accentColor.withValues(alpha: 0.9),
                    ),
                  ],
                ),
              ),
            )),
          ),
        );
      }).toList(),
    );
  }

  static const List<Color> _categoryColors = [
    Color(0xFFF9E872), // first category (yellow)
    Color(0xFF4DE2EC), // second category (cyan)
    Color(0xFFF59ED8),
    Color(0xFF8BE38B),
  ];

  Color _categoryColor(int index) => _categoryColors[(index < 0 ? 0 : index) % _categoryColors.length];

  /// Header of a category column: the admin-panel title of that category (from the day's classes, otherwise the
  /// title used most often at that position), e.g. "کلاس شناختی".
  String _categoryLabel(int index, List<CalendarEvent> dayEvents) {
    String? title;
    for (final e in dayEvents) {
      if (e.isClass && e.categoryIndex == index && (e.categoryTitle?.trim().isNotEmpty ?? false)) {
        title = e.categoryTitle;
        break;
      }
    }
    if (title == null) {
      final counts = <String, int>{};
      for (final e in _events) {
        final t = e.categoryTitle?.trim();
        if (e.isClass && e.categoryIndex == index && t != null && t.isNotEmpty) counts[t] = (counts[t] ?? 0) + 1;
      }
      if (counts.isNotEmpty) {
        title = (counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value))).first.key;
      }
    }
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    final number = (index + 1).toString().split('').map((d) => digits[int.parse(d)]).join();
    return title == null ? 'دسته $number' : 'کلاس ${StationCategories.shortLabel(title)}';
  }

  Widget _buildClassesSummaryCard() {
    final dayEvents = _events.where((e) =>
        e.year == _selectedYear &&
        e.month == _selectedMonth &&
        e.day == _selectedDay).toList();

    // One column per class category (by position, under its admin-panel title). The first two always show,
    // so the usual two-column layout stays; a station with more categories adds columns on its days.
    final Set<int> indexes = {0, 1, ...dayEvents.where((e) => e.isClass).map((e) => e.categoryIndex)};
    final List<int> columns = indexes.toList()..sort();

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
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Column(
          children: [
            // Column headers: the class categories (right to left, in admin-panel order)
            Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                children: [
                  for (int i = 0; i < columns.length; i++) ...[
                    if (i > 0)
                      Container(
                        width: 1,
                        height: 16,
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: _categoryColor(columns[i]),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Flexible(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                _categoryLabel(columns[i], dayEvents),
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: _categoryColor(columns[i]),
                                  fontSize: 12,
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

            // Column values: the day's classes of each category
            Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (int i = 0; i < columns.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: _buildEventColumnList(
                        events: dayEvents.where((e) => e.isClass && e.categoryIndex == columns[i]).toList(),
                        accentColor: _categoryColor(columns[i]),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}