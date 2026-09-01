import 'package:flutter/material.dart';
import '../models/station.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Set<int> _expandedIndices = {};
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _userProgress = [];

  @override
  void initState() {
    super.initState();
    _fetchStationsData();
  }

  Future<void> _fetchStationsData() async {
    try {
      final stations = await HttpApiService().getStations();
      final userProgress = await HttpApiService().getUserProgress();
      if (mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(stations);
          _userProgress = userProgress.cast<Map<String, dynamic>>();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AppRepository>(context).currentUser;
    int totalClipsOverall = 0;
    int completedClipsOverall = 0;

    for (var station in _stations) {
      if (station['categories'] != null) {
        for (var cat in station['categories']) {
          if (cat['sessions'] != null) {
            for (var sess in cat['sessions']) {
              if (sess['videoClips'] != null) {
                totalClipsOverall += (sess['videoClips'] as List).length;
                for (var clip in sess['videoClips']) {
                  final progressRecord = _userProgress.firstWhere(
                      (p) => p['clipId'] == clip['id'],
                      orElse: () => <String, dynamic>{});
                  if (progressRecord['isWatched'] == true ||
                      progressRecord['quizPassed'] == true) {
                    completedClipsOverall++;
                  }
                }
              }
            }
          }
        }
      }
    }

    double progress = 0.0;
    if (totalClipsOverall > 0) {
      progress = completedClipsOverall / totalClipsOverall;
    } else if (_stations.isNotEmpty) {
      final userLvl = user.levelFrame < 1 ? 1 : user.levelFrame;
      progress = (userLvl - 1) / _stations.length;
    }
    if (progress > 1.0) progress = 1.0;
    if (progress < 0.0) progress = 0.0;

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
      body: RefreshIndicator(
        onRefresh: _fetchStationsData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // Overall Progress Card
              _buildOverallProgressCard(progress, progressPercentText),
              const SizedBox(height: 25),
              
              // Map list of stations
              _isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: CircularProgressIndicator(color: Color(0xFFFFD54F))),
                    )
                  : (_stations.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(
                            child: Text(
                              'هنوز منزلگاهی ثبت نشده است',
                              style: TextStyle(color: Colors.white60, fontFamily: 'Vazirmatn'),
                            ),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _stations.length,
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
                            final item = _stations[index];
                            return _buildMapStationCard(context, index, item);
                          },
                        )),
              const SizedBox(height: 40),
            ],
          ),
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
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    
    // Station 1 (index == 0) is the initial station and is always unlocked!
    bool isLocked = index > 0 && (index + 1) > userLevelFrame && index > user.completedStationsCount;
    bool isCurrent = (index + 1) == userLevelFrame || (index == 0 && userLevelFrame <= 1);
    bool isCompleted = (index + 1) < userLevelFrame || index < user.completedStationsCount;

    // Count categories and sessions
    final categoriesList = (item['categories'] as List?) ?? [];
    int totalSessions = 0;
    int totalClips = 0;
    int completedClips = 0;

    for (var cat in categoriesList) {
      if (cat is Map && cat['sessions'] != null) {
        final sessList = (cat['sessions'] as List);
        totalSessions += sessList.length;
        for (var sess in sessList) {
          if (sess is Map && sess['videoClips'] != null) {
            final clipList = (sess['videoClips'] as List);
            totalClips += clipList.length;
            for (var clip in clipList) {
              if (clip is Map) {
                final progressRecord = _userProgress.firstWhere(
                  (p) => p['clipId'] == clip['id'],
                  orElse: () => <String, dynamic>{},
                );
                if (progressRecord['isWatched'] == true || progressRecord['quizPassed'] == true) {
                  completedClips++;
                }
              }
            }
          }
        }
      }
    }

    double stationProgress = 0.0;
    if (totalClips > 0) {
      stationProgress = completedClips / totalClips;
    } else {
      stationProgress = isCompleted ? 1.0 : (isCurrent ? 0.3 : 0.0);
    }

    final String teacherName = item['instructors']?.toString() ??
        item['subtitle']?.toString() ??
        item['teacher']?.toString() ??
        'استاد کاروان نپا';

    final String stationTitle = item['title']?.toString() ?? 'منزلگاه ${index + 1}';
    final String stationDesc = (item['subtitle'] != null && item['subtitle'].toString().trim().isNotEmpty)
        ? item['subtitle'].toString()
        : ((item['description'] != null && item['description'].toString().trim().isNotEmpty)
            ? item['description'].toString()
            : 'سرفصل‌ها و جلسات آموزشی کاروان');

    final String iconUrl = (item['iconUrl'] != null && item['iconUrl'].toString().startsWith('http'))
        ? item['iconUrl'].toString()
        : ((item['imageUrl'] != null && item['imageUrl'].toString().startsWith('http'))
            ? item['imageUrl'].toString()
            : 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=200');

    final Color accentColor = isLocked
        ? Colors.grey
        : (isCompleted ? const Color(0xFF10B981) : const Color(0xFFFFD54F));
    final bool isExpanded = _expandedIndices.contains(index);

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
                  color: accentColor.withValues(alpha: 0.4),
                  blurRadius: 15,
                  spreadRadius: 3,
                ),
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.15),
                  blurRadius: 30,
                  spreadRadius: 8,
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
                          id: item['id'] ?? '',
                          title: stationTitle,
                          teacher: teacherName,
                          progress: stationProgress,
                          isLocked: isLocked,
                          isCurrent: isCurrent,
                          imageUrl: iconUrl,
                          classesCount: totalSessions > 0 ? '$totalSessions جلسه' : '${categoriesList.length} سرفصل',
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
                                  ? Text('${index + 1}', style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 13))
                                  : const Text('🔒', style: TextStyle(fontSize: 14))),
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
                              stationTitle,
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
                              stationDesc,
                              textAlign: TextAlign.right,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
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
                            iconUrl,
                            fit: BoxFit.cover,
                            color: isLocked ? Colors.black54 : null,
                            colorBlendMode: isLocked ? BlendMode.saturation : null,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                color: Colors.white10,
                                child: const Icon(Icons.school, color: Colors.white30, size: 20),
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
                          '👤 استاد راهنما: $teacherName',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📚 جلسات و سرفصل‌ها: ${totalSessions > 0 ? "$totalSessions جلسه آموزشی" : "${categoriesList.length} سرفصل"}',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📊 وضعیت منزلگاه: ${isCompleted ? '۱۰۰٪ تکمیل شده ✅' : (isCurrent ? 'در حال یادگیری ⚡' : 'قفل شده 🔒')}',
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
                isLocked ? 'قفل' : (isCompleted ? 'تکمیل' : 'جاری'),
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
