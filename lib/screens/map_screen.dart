import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../services/app_state_repository.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Set<int> _expandedIndices = {};

  // Custom list of stations for the map
  final List<Map<String, dynamic>> mapStations = [
    {
      'title': 'کاروانسرای غبارگرفته',
      'subtitle': '۴ کلاس - تکمیل شده',
      'status': 'completed', // completed, current, locked
      'statusLabel': 'تکمیل',
      'icon': 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=200',
      'accentColor': const Color(0xFF10B981), // Green
      'teacher': 'استاد علوی',
      'progressText': '۱۰۰٪ تکمیل شده',
    },
    {
      'title': 'روستای مدفون در شن',
      'subtitle': '۴ کلاس - تکمیل شده',
      'status': 'completed',
      'statusLabel': 'تکمیل',
      'icon': 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=200',
      'accentColor': const Color(0xFF10B981),
      'teacher': 'استاد محمدی',
      'progressText': '۱۰۰٪ تکمیل شده',
    },
    {
      'title': 'رصدخانه',
      'subtitle': '۴ کلاس - در حال برگزاری',
      'status': 'current',
      'statusLabel': 'جاری',
      'icon': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=200',
      'accentColor': const Color(0xFFFFD54F), // Gold/Yellow
      'teacher': 'استاد رضایی',
      'progressText': '۷۵٪ در حال برگزاری',
    },
    {
      'title': 'مسجد بین دو راهی',
      'subtitle': '۴ کلاس - قفل',
      'status': 'locked',
      'statusLabel': 'قفل',
      'icon': 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?w=200',
      'accentColor': Colors.grey,
      'teacher': 'استاد حسینی',
      'progressText': '۰٪ قفل شده',
    }
  ];

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final totalChallenges = repository.challenges.length;
    final approvedSubmissions = repository.submissions.where((s) => s.status == 'approved').map((s) => s.challengeId).toSet();
    final completedChallenges = repository.challenges.where((c) => approvedSubmissions.contains(c.id)).length;
    final progress = totalChallenges > 0 ? completedChallenges / totalChallenges : 0.0;
    final progressPercentText = '${(progress * 100).toInt()}%';

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        title: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'مسیر کاروان به سوی گنج',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20, fontFamily: 'Vazirmatn'),
            ),
            SizedBox(width: 8),
            Text('🗺️', style: TextStyle(fontSize: 20)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Overall Progress Card
            _buildOverallProgressCard(progress, progressPercentText),
            const SizedBox(height: 25),
            
            // Map list of stations
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: mapStations.length,
              separatorBuilder: (context, index) => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Center(
                  child: Text(
                    '↓',
                    style: TextStyle(color: Colors.white30, fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              itemBuilder: (context, index) {
                final item = mapStations[index];
                return _buildMapStationCard(context, index, item);
              },
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildOverallProgressCard(double progress, String progressPercentText) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                progressPercentText,
                style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const Text(
                'پیشرفت کلی مسیر',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: const Color(0xFF160E2A),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFD54F)),
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildMapStationCard(BuildContext context, int index, Map<String, dynamic> item) {
    bool isCompleted = item['status'] == 'completed';
    bool isCurrent = item['status'] == 'current';
    bool isLocked = item['status'] == 'locked';
    Color accentColor = item['accentColor'];
    bool isExpanded = _expandedIndices.contains(index);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isCurrent ? accentColor : accentColor.withValues(alpha: 0.3),
          width: isCurrent ? 2.0 : 1.2,
        ),
        boxShadow: isCurrent
            ? [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.15),
                  blurRadius: 10,
                  spreadRadius: 2,
                )
              ]
            : null,
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Column(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    if (isLocked) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('این منزلگاه هنوز باز نشده است و قفل می‌باشد', style: TextStyle(fontFamily: 'Vazirmatn')),
                          backgroundColor: Colors.grey,
                        ),
                      );
                    } else {
                      Navigator.pushNamed(
                        context,
                        '/station_detail',
                        arguments: Station(
                          id: index.toString(),
                          title: item['title'],
                          teacher: item['teacher'],
                          progress: isCompleted ? 1.0 : (isCurrent ? 0.75 : 0.0),
                          isLocked: isLocked,
                          isCurrent: isCurrent,
                          imageUrl: item['icon'],
                          classesCount: '۴ کلاس',
                        ),
                      );
                    }
                  },
                  child: Row(
                    children: [
                      // Left: Circular Action Status Indicator
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: accentColor.withValues(alpha: 0.5), width: 1.5),
                          color: isCurrent ? accentColor.withValues(alpha: 0.2) : Colors.transparent,
                        ),
                        child: Center(
                          child: isCompleted
                              ? const Icon(Icons.check, color: Color(0xFF10B981), size: 18)
                              : (isCurrent
                                  ? const Text('۱', style: TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 13))
                                  : const Icon(Icons.lock, color: Colors.white30, size: 16)),
                        ),
                      ),
                      
                      const Spacer(),
                      
                      // Middle: Station Details
                      Expanded(
                        flex: 6,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              item['title'],
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                color: isLocked ? Colors.white30 : Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              item['subtitle'],
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                color: isLocked ? Colors.white24 : Colors.white60,
                                fontSize: 12,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(width: 16),
                      
                      // Right: Station Circular Image Box
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: accentColor, width: 2),
                        ),
                        child: ClipOval(
                          child: Image.network(
                            item['icon'],
                            fit: BoxFit.cover,
                            color: isLocked ? Colors.black54 : null,
                            colorBlendMode: isLocked ? BlendMode.saturation : null,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                color: Colors.white10,
                                child: const Icon(Icons.broken_image, color: Colors.white30, size: 20),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Expandable Panel with summary info
                AnimatedCrossFade(
                  firstChild: const SizedBox(width: double.infinity),
                  secondChild: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF160E2A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '👤 استاد راهنما: ${item['teacher']}',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          '📚 کلاس‌ها: ۴ کلاس مهارتی و رسانه‌ای',
                          style: TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📊 پیشرفت منزلگاه: ${item['progressText']}',
                          style: TextStyle(color: accentColor, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                      ],
                    ),
                  ),
                  crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                  duration: const Duration(milliseconds: 250),
                ),
                
                // Small Expand/Collapse Button
                const SizedBox(height: 8),
                Center(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        if (isExpanded) {
                          _expandedIndices.remove(index);
                        } else {
                          _expandedIndices.add(index);
                        }
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                            color: Colors.white54,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isExpanded ? 'بستن جزئیات' : 'نمایش جزئیات',
                            style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Badge overlay at top-right
          Positioned(
            top: -12,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                item['statusLabel'],
                style: TextStyle(
                  color: isCurrent ? Colors.black : Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
