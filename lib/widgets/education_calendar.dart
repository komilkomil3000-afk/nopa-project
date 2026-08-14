import 'package:flutter/material.dart';
import '../utils/constants.dart';

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
  late DateTime _selectedDateTime;
  int _selectedDay = 0;

  @override
  void initState() {
    super.initState();
    _selectedDateTime = DateTime.now();
    // Convert current day
    final jalali = _gregorianToJalali(_selectedDateTime.year, _selectedDateTime.month, _selectedDateTime.day);
    _selectedDay = jalali['day']!;
  }

  // Convert Gregorian to Jalali
  Map<String, int> _gregorianToJalali(int gy, int gm, int gd) {
    final List<int> gDaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    int jy = gy - 621;
    
    bool isGregorianLeap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
    if (isGregorianLeap) gDaysInMonth[2] = 29;
    
    int gDayNo = 0;
    for (int i = 1; i < gm; i++) {
      gDayNo += gDaysInMonth[i];
    }
    gDayNo += gd;
    
    int jDayNo;
    if (gDayNo > 79) {
      jDayNo = gDayNo - 79;
      jy += 1;
    } else {
      int jNp = ((gy - 1) % 4 == 0 && (gy - 1) % 100 != 0) || ((gy - 1) % 400 == 0) ? 366 : 365;
      jDayNo = gDayNo + jNp - 79;
    }
    
    int jm = 1;
    final List<int> jDaysInMonth = [0, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    for (int i = 1; i <= 12; i++) {
      if (jDayNo <= jDaysInMonth[i]) {
        jm = i;
        break;
      }
      jDayNo -= jDaysInMonth[i];
    }
    int jd = jDayNo;
    
    return {'year': jy, 'month': jm, 'day': jd};
  }

  int _getPersianWeekdayIndex(int dartWeekday) {
    switch (dartWeekday) {
      case DateTime.saturday: return 0;
      case DateTime.sunday: return 1;
      case DateTime.monday: return 2;
      case DateTime.tuesday: return 3;
      case DateTime.wednesday: return 4;
      case DateTime.thursday: return 5;
      case DateTime.friday: return 6;
      default: return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final jalaliNow = _gregorianToJalali(_selectedDateTime.year, _selectedDateTime.month, _selectedDateTime.day);
    final int jYear = jalaliNow['year']!;
    final int jMonth = jalaliNow['month']!;
    final int jDay = jalaliNow['day']!;

    final List<String> jalaliMonthNames = [
      "", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];

    // Determine days in current Jalali month
    int daysInMonth = 30;
    if (jMonth <= 6) {
      daysInMonth = 31;
    } else if (jMonth == 12) {
      // Check Jalali leap year roughly
      bool isLeap = ((jYear + 1) * 0.24219).frac() < 0.24219; // Simplified check
      daysInMonth = isLeap ? 30 : 29;
    }

    // Calculate weekday of 1st day of month
    // Saturday = 0, Sunday = 1, Monday = 2, Tuesday = 3, Wednesday = 4, Thursday = 5, Friday = 6
    int todayWeekdayIdx = _getPersianWeekdayIndex(_selectedDateTime.weekday);
    int firstDayWeekdayIdx = (todayWeekdayIdx - (jDay - 1)) % 7;
    if (firstDayWeekdayIdx < 0) firstDayWeekdayIdx += 7;

    // Custom events for mock representation
    final List<CalendarEvent> events = [
      CalendarEvent(day: 5, type: EventType.mediaClass, title: "کلاس رسانه‌ای ۱ (تفکر انتقادی)", time: "ساعت ۱۵:۰۰"),
      CalendarEvent(day: 12, type: EventType.skillClass, title: "کلاس مهارتی ۱ (هدف‌گذاری SMART)", time: "ساعت ۱۷:۰۰"),
      CalendarEvent(day: 18, type: EventType.assignment, title: "مهلت تحویل تمرین کار گروهی نپا", time: "ساعت ۲۳:۵۹"),
      CalendarEvent(day: 24, type: EventType.mediaClass, title: "کلاس رسانه‌ای ۲ (تولید محتوای خلاق)", time: "ساعت ۱۰:۰۰"),
    ];

    // Holidays (custom dates inside current month)
    final List<int> holidays = [15, 29]; // e.g. ولادت امام رضا (ع) و غدیر خم

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
                // Header (Month & Year)
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
                      ],
                    ),
                  ],
                ),
                const Divider(color: Colors.white10, height: 24),
                
                // Days of week header
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
                const SizedBox(height: 12),

                // Calendar Grid
                GridView.builder(
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
                    
                    // Friday check
                    final int weekdayOfCell = index % 7;
                    final bool isFriday = weekdayOfCell == 6;
                    final bool isHoliday = holidays.contains(currentDayNum);
                    
                    final dayEvents = events.where((e) => e.day == currentDayNum).toList();

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
                ),
              ],
            ),
          ),
          
          // Event Detail Panel
          const SizedBox(height: 20),
          _buildEventDetailsSection(events, holidays),
        ],
      ),
    );
  }

  Widget _buildEventDetailsSection(List<CalendarEvent> events, List<int> holidays) {
    final dayEvents = events.where((e) => e.day == _selectedDay).toList();
    final isHoliday = holidays.contains(_selectedDay);

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
                  typeColor = const Color(0xFFEC4899);
                  typeName = "کلاس رسانه";
                } else if (event.type == EventType.assignment) {
                  typeColor = const Color(0xFF10B981);
                  typeName = "تحویل تکلیف";
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

  Widget _buildDot(EventType type) {
    Color color;
    switch (type) {
      case EventType.mediaClass: color = const Color(0xFFEC4899); break;
      case EventType.skillClass: color = const Color(0xFFFFD54F); break;
      case EventType.assignment: color = const Color(0xFF10B981); break;
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 1),
      width: 5,
      height: 5,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

extension DoubleExtension on double {
  double frac() => this - truncateToDouble();
}