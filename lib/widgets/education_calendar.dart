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
  bool _isExpanded = true;
  
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
            EventType type = EventType.skillClass;
            if (e['type'] == 'mediaClass') {
              type = EventType.mediaClass;
            } else if (e['type'] == 'assignment') {
              type = EventType.assignment;
            }
            
            int evYear = _selectedYear;
            int evMonth = _selectedMonth;
            int evDay = 1;

            try {
              if (e['eventDate'] != null) {
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
              id: e['id'],
            ));
          }
        }
        
        final List<int> loadedHolidays = [];
        if (data['holidays'] != null) {
          for (var h in data['holidays']) {
            if (h is int) loadedHolidays.add(h);
          }
        }
        
        setState(() {
          _events = loadedEvents;
          _holidays = loadedHolidays;
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
      _selectedDay = 1;
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
      _selectedDay = 1;
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
                // Top Header with Month Navigation
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_right, color: Colors.white70, size: 22),
                          onPressed: _goToNextMonth,
                          tooltip: 'ماه بعد',
                        ),
                        Text(
                          "${_jalaliMonthNames[jMonth]} $jYear",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_left, color: Colors.white70, size: 22),
                          onPressed: _goToPreviousMonth,
                          tooltip: 'ماه قبل',
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        if (!isThisCurrentMonth)
                          GestureDetector(
                            onTap: _goToToday,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              margin: const EdgeInsets.only(left: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                              ),
                              child: const Text(
                                "امروز",
                                style: TextStyle(color: Color(0xFFC4B5FD), fontSize: 11, fontFamily: 'Vazirmatn'),
                              ),
                            ),
                          ),
                        GestureDetector(
                          onTap: () => setState(() => _isExpanded = !_isExpanded),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.05),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _isExpanded ? Icons.calendar_view_week : Icons.calendar_month,
                              color: const Color(0xFFFFD54F),
                              size: 18,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const Divider(color: Colors.white10, height: 20),
                
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

                // Calendar Grid or Strip
                _isExpanded 
                    ? _buildFullMonthGrid(daysInMonth, firstDayWeekdayIdx, isThisCurrentMonth ? jalaliNow.day : -1) 
                    : _build5DayStrip(isThisCurrentMonth ? jalaliNow.day : _selectedDay, daysInMonth, isThisCurrentMonth ? jalaliNow.day : -1),
                
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

  Widget _build5DayStrip(int centerDay, int daysInMonth, int realToday) {
    int startDay = centerDay - 2;
    if (startDay < 1) startDay = 1;
    if (startDay + 4 > daysInMonth) startDay = (daysInMonth - 4).clamp(1, daysInMonth);
    
    int count = (daysInMonth - startDay + 1).clamp(1, 5);
    List<int> visibleDays = List.generate(count, (index) => startDay + index);
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: visibleDays.map((d) => _buildDayCell(d, d == realToday, false)).toList(),
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
    final bool hasAssignment = dayEvents.any((e) => e.type == EventType.assignment);

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
        cellBorderColor = const Color(0xFF3B82F6).withValues(alpha: 0.3);
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
                  if (hasAssignment) _buildDot(EventType.assignment),
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
          _buildLegendItem(const Color(0xFF10B981), "تکلیف و چالش"),
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
                } else if (event.type == EventType.assignment) {
                  typeColor = const Color(0xFF10B981);
                  typeName = "تکلیف و چالش";
                  typeIcon = Icons.task_alt;
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