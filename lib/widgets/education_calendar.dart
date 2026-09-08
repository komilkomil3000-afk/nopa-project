import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../services/api_service.dart';
import 'package:shamsi_date/shamsi_date.dart';

enum EventType { mediaClass, skillClass, assignment }

class CalendarEvent {
  final int year;
  final int month;
  final int day;
  final EventType type;
  final String title;
  final String time;
  final String? stationTitle;
  final String? stationSubtitle;
  final String? instructor;
  final String? id;
  final String? jalaliDate;

  CalendarEvent({
    required this.year,
    required this.month,
    required this.day,
    required this.type,
    required this.title,
    required this.time,
    this.stationTitle,
    this.stationSubtitle,
    this.instructor,
    this.id,
    this.jalaliDate,
  });
}

class EducationCalendar extends StatefulWidget {
  const EducationCalendar({super.key});

  @override
  State<EducationCalendar> createState() => _EducationCalendarState();
}

class _EducationCalendarState extends State<EducationCalendar> {
  late Jalali _currentJalaliMonth;
  late int _selectedYear;
  late int _selectedMonth;
  late int _selectedDay;
  bool _isExpanded = false;
  
  List<CalendarEvent> _events = [];
  List<int> _holidays = [];
  bool _isLoading = true;

  final List<String> _jalaliMonthNames = [
    "", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
  ];

  final List<String> _persianWeekDays = [
    "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"
  ];

  @override
  void initState() {
    super.initState();
    final now = Jalali.now();
    _currentJalaliMonth = Jalali(now.year, now.month, 1);
    _selectedYear = now.year;
    _selectedMonth = now.month;
    _selectedDay = now.day;
    _fetchEvents();
  }

  Future<void> _fetchEvents() async {
    try {
      final data = await HttpApiService().getCalendarEvents();
      if (data != null && mounted) {
        final List<CalendarEvent> loadedEvents = [];
        if (data['events'] != null) {
          for (var e in data['events']) {
            // Exclude assignments and challenges from education calendar
            if (e['type'] == 'assignment' || e['type'] == 'challenge') {
              continue;
            }
            EventType type = EventType.skillClass;
            if (e['type'] == 'mediaClass') {
              type = EventType.mediaClass;
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
              } else if (e['eventDate'] != null) {
                final dt = DateTime.parse(e['eventDate']);
                final jalaliDt = Jalali.fromDateTime(dt);
                evYear = jalaliDt.year;
                evMonth = jalaliDt.month;
                evDay = jalaliDt.day;
              } else {
                evDay = e['day'] ?? 1;
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
              time: e['time'] ?? 'ساعت ۱۶:۰۰',
              stationTitle: e['stationTitle'],
              stationSubtitle: e['stationSubtitle'],
              instructor: e['instructor'],
              id: e['id']?.toString(),
              jalaliDate: e['jalaliDate'],
            ));
          }
        }
        
        final List<int> loadedHolidays = [];
        if (data['holidays'] != null) {
          for (var h in data['holidays']) {
            if (h is int) loadedHolidays.add(h);
          }
        }

        // Smart month targeting:
        // If current month has no scheduled events (e.g. app opened in Shahrivar),
        // automatically switch to the nearest upcoming month that has classes (Mehr 1405)!
        int targetYear = _selectedYear;
        int targetMonth = _selectedMonth;
        int targetDay = _selectedDay;

        final currentMonthHasEvents = loadedEvents.any((ev) => ev.year == targetYear && ev.month == targetMonth);
        if (!currentMonthHasEvents && loadedEvents.isNotEmpty) {
          final upcomingEvents = loadedEvents.where((ev) {
            if (ev.year > targetYear) return true;
            if (ev.year == targetYear && ev.month >= targetMonth) return true;
            return false;
          }).toList();

          final firstEvent = upcomingEvents.isNotEmpty ? upcomingEvents.first : loadedEvents.first;
          targetYear = firstEvent.year;
          targetMonth = firstEvent.month;
          targetDay = firstEvent.day;
        } else {
          // If current month has events, ensure selectedDay has events if possible
          final todayEvents = loadedEvents.where((ev) => ev.year == targetYear && ev.month == targetMonth && ev.day == targetDay).toList();
          if (todayEvents.isEmpty) {
            final monthEvents = loadedEvents.where((ev) => ev.year == targetYear && ev.month == targetMonth).toList();
            if (monthEvents.isNotEmpty) {
              targetDay = monthEvents.first.day;
            }
          }
        }
        
        setState(() {
          _events = loadedEvents;
          _holidays = loadedHolidays;
          _currentJalaliMonth = Jalali(targetYear, targetMonth, 1);
          _selectedYear = targetYear;
          _selectedMonth = targetMonth;
          _selectedDay = targetDay;
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }


  void _goToPreviousMonth() {
    setState(() {
      if (_currentJalaliMonth.month == 1) {
        _currentJalaliMonth = Jalali(_currentJalaliMonth.year - 1, 12, 1);
      } else {
        _currentJalaliMonth = Jalali(_currentJalaliMonth.year, _currentJalaliMonth.month - 1, 1);
      }
      _selectedYear = _currentJalaliMonth.year;
      _selectedMonth = _currentJalaliMonth.month;
      final monthEvents = _events.where((e) => e.year == _selectedYear && e.month == _selectedMonth).toList();
      _selectedDay = monthEvents.isNotEmpty ? monthEvents.first.day : 1;
    });
  }

  void _goToNextMonth() {
    setState(() {
      if (_currentJalaliMonth.month == 12) {
        _currentJalaliMonth = Jalali(_currentJalaliMonth.year + 1, 1, 1);
      } else {
        _currentJalaliMonth = Jalali(_currentJalaliMonth.year, _currentJalaliMonth.month + 1, 1);
      }
      _selectedYear = _currentJalaliMonth.year;
      _selectedMonth = _currentJalaliMonth.month;
      final monthEvents = _events.where((e) => e.year == _selectedYear && e.month == _selectedMonth).toList();
      _selectedDay = monthEvents.isNotEmpty ? monthEvents.first.day : 1;
    });
  }

  void _goToToday() {
    final now = Jalali.now();
    setState(() {
      _currentJalaliMonth = Jalali(now.year, now.month, 1);
      _selectedYear = now.year;
      _selectedMonth = now.month;
      _selectedDay = now.day;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: CircularProgressIndicator(color: Color(0xFF8B5CF6)),
        ),
      );
    }

    final jalaliNow = Jalali.now();
    final int jYear = _currentJalaliMonth.year;
    final int jMonth = _currentJalaliMonth.month;
    final int daysInMonth = _currentJalaliMonth.monthLength;

    // First day of month weekday (0 = Saturday, 6 = Friday)
    final firstDayJalali = Jalali(jYear, jMonth, 1);
    final int firstDayWeekdayIdx = firstDayJalali.weekDay - 1;

    final bool isThisCurrentMonth = (jYear == jalaliNow.year && jMonth == jalaliNow.month);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.cardBackground,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Top Actions: بزرگنمایی and امروز
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    GestureDetector(
                      onTap: () => setState(() => _isExpanded = !_isExpanded),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _isExpanded ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                              color: const Color(0xFFFFD54F),
                              size: 17,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _isExpanded ? "کوچک‌نمایی" : "بزرگنمایی",
                              style: const TextStyle(
                                color: Color(0xFFFFD54F),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (!isThisCurrentMonth)
                      GestureDetector(
                        onTap: _goToToday,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.today_rounded, color: Color(0xFFC4B5FD), size: 14),
                              SizedBox(width: 4),
                              Text(
                                "امروز",
                                style: TextStyle(color: Color(0xFFC4B5FD), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // Month Switcher with Two Arrows on Sides
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // فلش ماه قبل (سمت راست در راست‌به‌چپ)
                      InkWell(
                        onTap: _goToPreviousMonth,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 13),
                              SizedBox(width: 4),
                              Text(
                                "ماه قبل",
                                style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // عنوان ماه و سال در وسط
                      Text(
                        "${_jalaliMonthNames[jMonth]} $jYear",
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16.5,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),

                      // فلش ماه بعد (سمت چپ در راست‌به‌چپ)
                      InkWell(
                        onTap: _goToNextMonth,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                "ماه بعد",
                                style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                              ),
                              SizedBox(width: 4),
                              Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 13),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Day Headers
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: const [
                    Text("ش", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("ی", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("د", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("س", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("چ", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("پ", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    Text("ج", style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                  ],
                ),
                const SizedBox(height: 10),

                // Calendar Grid or Compact Week Row (with swipe support)
                GestureDetector(
                  onHorizontalDragEnd: (details) {
                    if (details.primaryVelocity != null) {
                      if (details.primaryVelocity! > 250) {
                        _goToPreviousMonth();
                      } else if (details.primaryVelocity! < -250) {
                        _goToNextMonth();
                      }
                    }
                  },
                  child: _isExpanded 
                      ? _buildFullMonthGrid(daysInMonth, firstDayWeekdayIdx, isThisCurrentMonth ? jalaliNow.day : -1) 
                      : _buildCompactWeekRow(daysInMonth, firstDayWeekdayIdx, isThisCurrentMonth ? jalaliNow.day : -1),
                ),
                
                const SizedBox(height: 14),
                _buildLegend(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildEventDetailsSection(),
        ],
      ),
    );
  }

  Widget _buildCompactWeekRow(int daysInMonth, int firstDayWeekdayIdx, int realToday) {
    final int selectedCellIdx = firstDayWeekdayIdx + (_selectedDay - 1);
    final int weekRow = selectedCellIdx ~/ 7;
    final int startCellIdx = weekRow * 7;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: List.generate(7, (col) {
        final int cellIndex = startCellIdx + col;
        if (cellIndex < firstDayWeekdayIdx || cellIndex >= firstDayWeekdayIdx + daysInMonth) {
          return const Expanded(
            child: SizedBox(height: 44),
          );
        }

        final int dayNum = cellIndex - firstDayWeekdayIdx + 1;
        final bool isFriday = (col == 6);
        final bool isToday = (dayNum == realToday);

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2.5),
            child: SizedBox(
              height: 48,
              child: _buildDayCell(dayNum, isToday, isFriday),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildFullMonthGrid(int daysInMonth, int firstDayWeekdayIdx, int realToday) {
    final int totalCells = daysInMonth + firstDayWeekdayIdx;
    
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: totalCells,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
        childAspectRatio: 0.95,
      ),
      itemBuilder: (context, index) {
        if (index < firstDayWeekdayIdx) {
          return const SizedBox.shrink();
        }

        final int dayNum = index - firstDayWeekdayIdx + 1;
        final int weekdayOfCell = index % 7;
        final bool isFriday = weekdayOfCell == 6;
        final bool isToday = (dayNum == realToday);

        return _buildDayCell(dayNum, isToday, isFriday);
      },
    );
  }

  Widget _buildDayCell(int dayNum, bool isToday, bool isFriday) {
    final bool isSelected = (_selectedYear == _currentJalaliMonth.year && 
                             _selectedMonth == _currentJalaliMonth.month && 
                             _selectedDay == dayNum);
    
    final bool isHoliday = _holidays.contains(dayNum);
    
    // Filter events for this exact day in the displayed month/year
    final dayEvents = _events.where((e) => 
      e.year == _currentJalaliMonth.year && 
      e.month == _currentJalaliMonth.month && 
      e.day == dayNum
    ).toList();

    final bool hasSkillClass = dayEvents.any((e) => e.type == EventType.skillClass);
    final bool hasMediaClass = dayEvents.any((e) => e.type == EventType.mediaClass);

    // Color theme for cell based on scheduled classes
    Color cellBorderColor = Colors.white.withValues(alpha: 0.06);
    Color cellBgColor = Colors.transparent;

    if (isSelected) {
      cellBgColor = const Color(0xFF7C3AED);
      cellBorderColor = const Color(0xFFA78BFA);
    } else if (isToday) {
      cellBgColor = const Color(0xFF8B5CF6).withValues(alpha: 0.2);
      cellBorderColor = const Color(0xFFFFD54F);
    } else if (dayEvents.isNotEmpty) {
      if (hasSkillClass && hasMediaClass) {
        cellBgColor = const Color(0xFF3B82F6).withValues(alpha: 0.12);
        cellBorderColor = const Color(0xFF38BDF8).withValues(alpha: 0.35);
      } else if (hasSkillClass) {
        cellBgColor = const Color(0xFFEF4444).withValues(alpha: 0.1);
        cellBorderColor = const Color(0xFFEF4444).withValues(alpha: 0.3);
      } else if (hasMediaClass) {
        cellBgColor = const Color(0xFF3B82F6).withValues(alpha: 0.1);
        cellBorderColor = const Color(0xFF38BDF8).withValues(alpha: 0.3);
      }
    }

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedYear = _currentJalaliMonth.year;
          _selectedMonth = _currentJalaliMonth.month;
          _selectedDay = dayNum;
        });
      },
      child: Container(
        decoration: BoxDecoration(
          color: cellBgColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: cellBorderColor,
            width: isSelected || isToday ? 1.8 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.4),
                    blurRadius: 8,
                    spreadRadius: 1,
                  )
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              "$dayNum",
              style: TextStyle(
                color: isSelected 
                    ? Colors.white 
                    : (isFriday || isHoliday 
                        ? const Color(0xFFF87171) 
                        : (isToday 
                            ? const Color(0xFFFFD54F) 
                            : (dayEvents.isNotEmpty ? Colors.white : Colors.white60))),
                fontWeight: isSelected || isToday || dayEvents.isNotEmpty ? FontWeight.bold : FontWeight.normal,
                fontSize: 13,
                fontFamily: 'Vazirmatn',
              ),
            ),
            if (dayEvents.isNotEmpty) ...[
              const SizedBox(height: 3),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (hasSkillClass) _buildDot(EventType.skillClass),
                  if (hasMediaClass) _buildDot(EventType.mediaClass),
                ],
              ),
            ],
            if (isHoliday && dayEvents.isEmpty) ...[
              const SizedBox(height: 2),
              const Icon(Icons.star, color: Colors.redAccent, size: 7),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 14,
        runSpacing: 6,
        children: [
          _buildLegendItem(const Color(0xFFEF4444), "کلاس مهارتی"),
          _buildLegendItem(const Color(0xFF38BDF8), "کلاس رسانه‌ای"),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(text, style: const TextStyle(color: Colors.white70, fontSize: 10.5, fontFamily: 'Vazirmatn')),
      ],
    );
  }

  Widget _buildDot(EventType type) {
    Color color;
    switch (type) {
      case EventType.mediaClass: color = const Color(0xFF38BDF8); break; // Sky blue
      case EventType.skillClass: color = const Color(0xFFEF4444); break; // Red
      case EventType.assignment: color = const Color(0xFF10B981); break; // Emerald
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 1.5),
      width: 5,
      height: 5,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }

  Widget _buildEventDetailsSection() {
    // Filter events for the selected date
    final dayEvents = _events.where((e) => 
      e.year == _selectedYear && 
      e.month == _selectedMonth && 
      e.day == _selectedDay
    ).toList();

    // Calculate Persian day of the week for the selected date
    final selectedJalali = Jalali(_selectedYear, _selectedMonth, _selectedDay);
    final String weekDayName = _persianWeekDays[selectedJalali.weekDay - 1];
    final String fullSelectedDateStr = "$weekDayName $_selectedDay ${_jalaliMonthNames[_selectedMonth]} $_selectedYear";

    final isHoliday = _holidays.contains(_selectedDay);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.event_note, color: Color(0xFF38BDF8), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    "برنامه $fullSelectedDateStr",
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
              if (dayEvents.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    "${dayEvents.length} کلاس",
                    style: const TextStyle(color: Color(0xFFC4B5FD), fontSize: 10.5, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                  ),
                ),
            ],
          ),
          const Divider(color: Colors.white10, height: 20),
          
          if (isHoliday) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.celebration, color: Colors.redAccent, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "تعطیل رسمی تقویم",
                      style: TextStyle(color: Colors.redAccent, fontSize: 11.5, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (dayEvents.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Column(
                  children: [
                    Icon(Icons.event_available, color: Colors.white.withValues(alpha: 0.2), size: 36),
                    const SizedBox(height: 8),
                    const Text(
                      "در این روز کلاس یا رویدادی برنامه‌ریزی نشده است.",
                      style: TextStyle(color: Colors.white38, fontSize: 11.5, fontFamily: 'Vazirmatn'),
                    ),
                  ],
                ),
              ),
            )
          else
            Column(
              children: dayEvents.map((event) {
                Color typeColor = const Color(0xFFEF4444);
                String typeName = "کلاس مهارتی";
                IconData typeIcon = Icons.fitness_center;
                
                if (event.type == EventType.mediaClass) {
                  typeColor = const Color(0xFF38BDF8);
                  typeName = "کلاس رسانه‌ای";
                  typeIcon = Icons.mic;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF150D27),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: typeColor.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: typeColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(typeIcon, color: typeColor, size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    event.title,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: typeColor.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    typeName,
                                    style: TextStyle(
                                      color: typeColor,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            if (event.stationTitle != null)
                              Text(
                                "📍 ${event.stationTitle}${event.stationSubtitle != null ? ' - ${event.stationSubtitle}' : ''}",
                                style: const TextStyle(
                                  color: Color(0xFF38BDF8),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                            const SizedBox(height: 3),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  "⏰ ${event.time}",
                                  style: const TextStyle(color: Colors.white60, fontSize: 10.5, fontFamily: 'Vazirmatn'),
                                ),
                                if (event.instructor != null)
                                  Text(
                                    "👤 ${event.instructor}",
                                    style: const TextStyle(color: Colors.white60, fontSize: 10.5, fontFamily: 'Vazirmatn'),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}