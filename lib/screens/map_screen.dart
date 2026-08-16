import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Set<int> _expandedIndices = {};
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];

  @override
  void initState() {
    super.initState();
    _fetchStationsData();
  }

  Future<void> _fetchStationsData() async {
    try {
      final stations = await HttpApiService().getStations();
      if (mounted) {
        setState(() {
          _stations = stations;
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

  bool _isStationLocked(Map<String, dynamic> station) {
    if (station['releaseDate'] != null) {
      try {
        final releaseDateTime = DateTime.parse(station['releaseDate']);
        if (releaseDateTime.isAfter(DateTime.now())) {
          return true;
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  }

  @override
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
    final bool isLocked = _isStationLocked(item);
    final bool isCompleted = !isLocked && index == 0;
    final bool isCurrent = !isLocked && !isCompleted;
    final Color accentColor = isLocked
        ? Colors.grey
        : (isCompleted ? const Color(0xFF10B981) : const Color(0xFFFFD54F));
    final bool isExpanded = _expandedIndices.contains(index);

    final int totalCls = item['categories'] != null
        ? (item['categories'] as List).fold<int>(0, (prev, el) => prev + (el['sessions'] != null ? (el['sessions'] as List).length : 0))
        : 0;

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
                          id: item['id'] ?? '',
                          title: item['title'] ?? '',
                          teacher: item['teacher'] ?? 'استاد نپا',
                          progress: isCompleted ? 1.0 : (isCurrent ? 0.75 : 0.0),
                          isLocked: isLocked,
                          isCurrent: isCurrent,
                          imageUrl: item['iconUrl'] ?? 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=200',
                          classesCount: '$totalCls کلاس',
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
                              item['title'] ?? '',
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
                              item['description'] ?? 'بدون توضیحات',
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
                            item['iconUrl'] ?? 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=200',
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
                          '👤 استاد راهنما: ${item['teacher'] ?? 'استاد نپا'}',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📚 کلاس‌ها: $totalCls کلاس در دسته‌بندی‌های آموزشی',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📊 پیشرفت منزلگاه: ${isCompleted ? '۱۰۰٪ تکمیل شده' : (isCurrent ? '۷۵٪ در حال برگزاری' : '۰٪ قفل شده')}',
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
