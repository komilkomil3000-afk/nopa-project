import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../services/api_service.dart';
import 'package:shamsi_date/shamsi_date.dart';

enum EventType { mediaClass, skillClass, assignment }

class CalendarEvent {
  final int day;
  final EventType type;
  final String title;
  final String time;

  CalendarEvent({required this.day, required this.type, required this.title, required this.time});
}

class EducationCalendar extends StatefulWidget {
  const EducationCalendar({super.key});

  @override
  State<EducationCalendar> createState() => _EducationCalendarState();
}

class _EducationCalendarState extends State<EducationCalendar> {
  late Jalali _selectedDateTime;
  int _selectedDay = 0;
  bool _isExpanded = false;
  
  List<CalendarEvent> _events = [];
  List<int> _holidays = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _selectedDateTime = Jalali.now();
    _selectedDay = _selectedDateTime.day;
    _fetchEvents();
  }

  Future<void> _fetchEvents() async {
    final data = await HttpApiService().getCalendarEvents();
    if (data != null) {
      final List<CalendarEvent> loadedEvents = [];
      if (data['events'] != null) {
        for (var e in data['events']) {
          EventType type = EventType.skillClass;
          if (e['type'] == 'mediaClass') {
            type = EventType.mediaClass;
          } else if (e['type'] == 'assignment') {
            type = EventType.assignment;
          }
          
          int evDay = 1;
          try {
            if (e['eventDate'] != null) {
              final dt = DateTime.parse(e['eventDate']);
              final jalaliDt = Jalali.fromDateTime(dt);
              evDay = jalaliDt.day;
            } else {
              evDay = e['day'] ?? 1;
            }
          } catch (_) {
            evDay = e['day'] ?? 1;
          }
          
          loadedEvents.add(CalendarEvent(
            day: evDay,
            type: type,
            title: e['title'],
            time: e['time'],
          ));
        }
      }
      
      final List<int> loadedHolidays = [];
      if (data['holidays'] != null) {
        for (var h in data['holidays']) {
          loadedHolidays.add(h);
        }
      }
      
      if (mounted) {
        setState(() {
          _events = loadedEvents;
          _holidays = loadedHolidays;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final jalaliNow = Jalali.now();
    final int jYear = jalaliNow.year;
    final int jMonth = jalaliNow.month;
    final int jDay = jalaliNow.day;

    final List<String> jalaliMonthNames = [
      "", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];

    int daysInMonth = jalaliNow.monthLength;

    int todayWeekdayIdx = jalaliNow.weekDay - 1;
    int firstDayWeekdayIdx = (todayWeekdayIdx - (jDay - 1)) % 7;
    if (firstDayWeekdayIdx < 0) firstDayWeekdayIdx += 7;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.cardBackground,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "${jalaliMonthNames[jMonth]} $jYear",
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    Row(
                      children: [
                        Text(
                          "امروز: $jDay ${jalaliMonthNames[jMonth]}",
                          style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.today, color: Color(0xFFFFD54F), size: 16),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => setState(() => _isExpanded = !_isExpanded),
                          child: Icon(_isExpanded ? Icons.expand_less : Icons.expand_more, color: Colors.white),
                        )
                      ],
                    ),
                  ],
                ),
                const Divider(color: Colors.white10, height: 24),
                
                if (_isExpanded)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: const [
                      Text("ش", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("ی", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("د", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("س", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("چ", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("پ", style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                      Text("ج", style: TextStyle(color: Colors.redAccent, fontSize: 12, fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold)),
                    ],
                  ),
                if (_isExpanded) const SizedBox(height: 12),

                _isExpanded ? _buildFullMonthGrid(daysInMonth, firstDayWeekdayIdx, jDay) : _build5DayStrip(jDay, daysInMonth),
                
                const SizedBox(height: 16),
                _buildLegend(),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _buildEventDetailsSection(),
        ],
      ),
    );
  }

  Widget _build5DayStrip(int jDay, int daysInMonth) {
    int startDay = jDay - 2;
    if (startDay < 1) startDay = 1;
    if (startDay + 4 > daysInMonth) startDay = daysInMonth - 4;
    
    List<int> visibleDays = List.generate(5, (index) => startDay + index);
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: visibleDays.map((d) {
        final bool isCurrentDay = d == jDay;
        final bool isSelected = d == _selectedDay;
        final bool isHoliday = _holidays.contains(d);
        final dayEvents = _events.where((e) => e.day == d).toList();

        return GestureDetector(
          onTap: () {
            setState(() {
              _selectedDay = d;
            });
          },
          child: Container(
            width: 45,
            height: 60,
            decoration: BoxDecoration(
              color: isSelected 
                  ? const Color(0xFF8B5CF6) 
                  : (isCurrentDay ? const Color(0xFF8B5CF6).withValues(alpha: 0.2) : Colors.transparent),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isCurrentDay ? const Color(0xFF8B5CF6) : (isHoliday ? Colors.redAccent.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05)),
                width: isCurrentDay || isSelected ? 1.5 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "$d",
                  style: TextStyle(
                    color: isSelected 
                        ? Colors.white 
                        : (isHoliday ? Colors.redAccent : (dayEvents.isNotEmpty ? const Color(0xFFFFD54F) : Colors.white70)),
                    fontWeight: isCurrentDay || isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 14,
                  ),
                ),
                if (dayEvents.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: dayEvents.map((e) => _buildDot(e.type)).toList(),
                  ),
                ],
                if (isHoliday) ...[
                  const SizedBox(height: 2),
                  const Icon(Icons.star, color: Colors.redAccent, size: 8),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildFullMonthGrid(int daysInMonth, int firstDayWeekdayIdx, int jDay) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: daysInMonth + firstDayWeekdayIdx,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemBuilder: (context, index) {
        if (index < firstDayWeekdayIdx) {
          return const SizedBox.shrink();
        }

        final int currentDayNum = index - firstDayWeekdayIdx + 1;
        final bool isCurrentDay = currentDayNum == jDay;
        final bool isSelected = currentDayNum == _selectedDay;
        
        final int weekdayOfCell = index % 7;
        final bool isFriday = weekdayOfCell == 6;
        final bool isHoliday = _holidays.contains(currentDayNum);
        
        final dayEvents = _events.where((e) => e.day == currentDayNum).toList();

        return GestureDetector(
          onTap: () {
            setState(() {
              _selectedDay = currentDayNum;
            });
          },
          child: Container(
            decoration: BoxDecoration(
              color: isSelected 
                  ? const Color(0xFF8B5CF6) 
                  : (isCurrentDay ? const Color(0xFF8B5CF6).withValues(alpha: 0.2) : Colors.transparent),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isCurrentDay ? const Color(0xFF8B5CF6) : (isHoliday || isFriday ? Colors.redAccent.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05)),
                width: isCurrentDay || isSelected ? 1.5 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "$currentDayNum",
                  style: TextStyle(
                    color: isSelected 
                        ? Colors.white 
                        : (isFriday || isHoliday ? Colors.redAccent : (dayEvents.isNotEmpty ? const Color(0xFFFFD54F) : Colors.white70)),
                    fontWeight: isCurrentDay || isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
                if (dayEvents.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: dayEvents.map((e) => _buildDot(e.type)).toList(),
                  ),
                ],
                if (isHoliday) ...[
                  const SizedBox(height: 2),
                  const Icon(Icons.star, color: Colors.redAccent, size: 8),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 12,
        children: [
          _buildLegendItem(const Color(0xFFEF4444), "کلاس مهارتی"), // 🔴 Red
          _buildLegendItem(const Color(0xFF3B82F6), "کلاس رسانه"), // 🔵 Blue
          _buildLegendItem(const Color(0xFF10B981), "چالش و تکلیف"), // 🟢 Green
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(color: Colors.white70, fontSize: 10, fontFamily: 'Vazirmatn')),
      ],
    );
  }

  Widget _buildDot(EventType type) {
    Color color;
    switch (type) {
      case EventType.mediaClass: color = const Color(0xFF3B82F6); break; // Blue
      case EventType.skillClass: color = const Color(0xFFEF4444); break; // Red
      case EventType.assignment: color = const Color(0xFF10B981); break; // Green
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 1),
      width: 5,
      height: 5,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }

  Widget _buildEventDetailsSection() {
    final dayEvents = _events.where((e) => e.day == _selectedDay).toList();
    final isHoliday = _holidays.contains(_selectedDay);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "رویدادهای روز $_selectedDay ماه",
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
              const Icon(Icons.event_note, color: Colors.white54, size: 20),
            ],
          ),
          const Divider(color: Colors.white10, height: 20),
          if (isHoliday) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: const [
                  Icon(Icons.celebration, color: Colors.redAccent, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "مناسبت خاص / تعطیل رسمی رسمی تقویم",
                      style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (dayEvents.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Text(
                  "کلاس یا رویداد آموزشی برای این روز ثبت نشده است.",
                  style: TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'Vazirmatn'),
                ),
              ),
            )
          else
            Column(
              children: dayEvents.map((event) {
                Color typeColor = const Color(0xFF8B5CF6);
                String typeName = "کلاس";
                if (event.type == EventType.mediaClass) {
                  typeColor = const Color(0xFF3B82F6);
                  typeName = "کلاس رسانه";
                } else if (event.type == EventType.assignment) {
                  typeColor = const Color(0xFF10B981);
                  typeName = "تحویل تکلیف";
                } else if (event.type == EventType.skillClass) {
                  typeColor = const Color(0xFFEF4444);
                  typeName = "کلاس مهارتی";
                }
                
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF160E2A),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: typeColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          typeName,
                          style: TextStyle(color: typeColor, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              event.title,
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              event.time,
                              style: const TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'Vazirmatn'),
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

extension DoubleExtension on double {
  double frac() => this - truncateToDouble();
}