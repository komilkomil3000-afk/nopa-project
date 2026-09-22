import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';
import '../widgets/pending_challenges_dialog.dart';
import '../widgets/station_progress_stepper.dart';
import '../main.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Set<int> _expandedIndices = {};
  bool _isLoading = true;
  int _selectedStationIndex = 0;
  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _userProgress = [];
  final ScrollController _scrollController = ScrollController();
  final Map<int, GlobalKey> _cardKeys = {};

  @override
  void initState() {
    super.initState();
    _fetchStationsData();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
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
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _scrollToStation(int index) {
    final key = _cardKeys[index];
    if (key != null && key.currentContext != null) {
      Scrollable.ensureVisible(
        key.currentContext!,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        alignment: 0.1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AppRepository>(context).currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int totalStationNodes = _stations.isNotEmpty ? _stations.length : 6;

    return RefreshIndicator(
      onRefresh: _fetchStationsData,
      color: const Color(0xFFCD8449),
      child: SingleChildScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            const SizedBox(height: 6),
            // 1. Horizontal Station Progress Track Header with Nodes
            StationProgressStepper(
              currentStationIndex: _selectedStationIndex,
              totalNodes: totalStationNodes,
              userLevelFrame: userLevelFrame,
              completedStationsCount: user.completedStationsCount,
              onStationSelected: (index) {
                setState(() {
                  _selectedStationIndex = index;
                });
                _scrollToStation(index);
              },
            ),

                // 3. Station Road List
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  child: _isLoading
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32.0),
                            child: CircularProgressIndicator(color: Color(0xFFC7B299)),
                          ),
                        )
                      : (_stations.isEmpty
                          ? const Center(
                              child: Padding(
                                padding: EdgeInsets.all(24.0),
                                child: Text(
                                  'هنوز منزلگاهی بارگذاری نشده است',
                                  style: TextStyle(color: Colors.white60, fontFamily: AppTheme.fontFamily),
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
                                _cardKeys.putIfAbsent(index, () => GlobalKey());
                                final item = _stations[index];
                                return Container(
                                  key: _cardKeys[index],
                                  child: _buildMapStationCard(context, index, item),
                                );
                              },
                            )),
                ),
                const SizedBox(height: 40),
              ],
            ),
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

    final String stationTitle = Station.getPureName(index, item['title']?.toString());
    final String stationDesc = (item['subtitle'] != null && item['subtitle'].toString().trim().isNotEmpty)
        ? item['subtitle'].toString()
        : ((item['description'] != null && item['description'].toString().trim().isNotEmpty)
            ? item['description'].toString()
            : 'سرفصل‌ها و جلسات آموزشی کاروان');

    final String iconUrl = (item['iconUrl'] != null && item['iconUrl'].toString().startsWith('http'))
        ? item['iconUrl'].toString()
        : ((item['imageUrl'] != null && item['imageUrl'].toString().startsWith('http'))
            ? item['imageUrl'].toString()
            : '');

    final String resolvedImg = ApiConstants.resolveImageUrl(iconUrl);
    final bool hasValidImg = resolvedImg.isNotEmpty && resolvedImg.startsWith('http') && !resolvedImg.contains('placeholder');

    final bool isExpanded = _expandedIndices.contains(index);
    final bool isGold = isCurrent;

    return _RotatingBorderCard(
      isCurrent: isCurrent,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20.4),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.53, 1.0],
            colors: [
              Color(0xFF3D3C67),
              Color(0xFF36345C),
              Color(0xFF333359),
            ],
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Directionality(
              textDirection: TextDirection.rtl,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Column(
                  children: [
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () async {
                        if (isLocked) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('این منزلگاه هنوز باز نشده است و قفل می‌باشد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                              backgroundColor: Colors.grey,
                            ),
                          );
                          return;
                        }

                        final isNewStation = index > 0 && !isCompleted;
                        final appState = Provider.of<AppRepository>(context, listen: false);
                        if (isNewStation && appState.hasPendingChallenges) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('شما باید چالش‌هایتان را تکمیل کنید', style: TextStyle(fontFamily: AppTheme.fontFamily, fontWeight: FontWeight.bold)),
                              backgroundColor: Colors.redAccent,
                              duration: Duration(seconds: 3),
                            ),
                          );
                          PendingChallengesDialog.show(context, appState.uncompletedChallengesCount);
                          return;
                        }

                        final result = await Navigator.pushNamed(
                          context,
                          '/class1',
                          arguments: Station(
                            id: item['id'] ?? '',
                            title: stationTitle,
                            teacher: teacherName,
                            progress: stationProgress,
                            isLocked: isLocked,
                            isCurrent: isCurrent,
                            imageUrl: iconUrl,
                            classesCount: totalSessions > 0 ? '$totalSessions جلسه' : '${categoriesList.length} سرفصل',
                            orderIndex: index,
                          ),
                        );
                        if (result is int && context.mounted) {
                          navigateToMainTab(result);
                        }
                      },
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // 1. Right in RTL: Rectangular Station Image (Proportional to A4 aspect ratio 1:1.414) with gallery SVG
                          Container(
                            width: 56,
                            height: 79,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isGold ? const Color(0xFFFFD580) : const Color(0xFF9292E2),
                                width: 1.5,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8.5),
                              child: Container(
                                color: const Color(0xFF2E2E50),
                                child: hasValidImg
                                    ? CachedNetworkImage(
                                        imageUrl: resolvedImg,
                                        fit: BoxFit.cover,
                                        memCacheWidth: 200,
                                        memCacheHeight: 280,
                                        color: isLocked ? Colors.black54 : null,
                                        colorBlendMode: isLocked ? BlendMode.saturation : null,
                                        placeholder: (context, url) => Container(
                                          color: const Color(0xFF2E2E50),
                                          alignment: Alignment.center,
                                          child: SvgPicture.asset(
                                            'assets/svg_icons/imagenot01.svg',
                                            width: 28,
                                            height: 28,
                                            fit: BoxFit.contain,
                                          ),
                                        ),
                                        errorWidget: (context, url, error) => Container(
                                          color: const Color(0xFF2E2E50),
                                          alignment: Alignment.center,
                                          child: SvgPicture.asset(
                                            'assets/svg_icons/imagenot01.svg',
                                            width: 28,
                                            height: 28,
                                            fit: BoxFit.contain,
                                          ),
                                        ),
                                      )
                                    : Center(
                                        child: SvgPicture.asset(
                                          'assets/svg_icons/imagenot01.svg',
                                          width: 28,
                                          height: 28,
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                              ),
                            ),
                          ),

                          const SizedBox(width: 14),

                          // 2. Middle: Pure Station Title & Description (Right-aligned in RTL, no number badge)
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  stationTitle,
                                  textAlign: TextAlign.right,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isLocked ? Colors.white54 : Colors.white,
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  stationDesc,
                                  textAlign: TextAlign.right,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isLocked ? Colors.white30 : const Color(0xFFB5B3C8),
                                    fontSize: 12,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'استاد: $teacherName',
                                  textAlign: TextAlign.right,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 11,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(width: 12),

                          // 3. Left in RTL: SVG Lock + Small Info Toggle Icon Underneath
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              if (isCompleted)
                                SvgPicture.asset(
                                  'assets/svg_icons/lock01.svg',
                                  width: 24,
                                  height: 24,
                                  fit: BoxFit.contain,
                                )
                              else if (isCurrent)
                                SvgPicture.asset(
                                  'assets/svg_icons/lock01.svg',
                                  width: 24,
                                  height: 24,
                                  fit: BoxFit.contain,
                                  colorFilter: const ColorFilter.mode(Color(0xFFFFD580), BlendMode.srcIn),
                                )
                              else
                                SvgPicture.asset(
                                  'assets/svg_icons/lock02.svg',
                                  width: 24,
                                  height: 24,
                                  fit: BoxFit.contain,
                                ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  setState(() {
                                    if (isExpanded) {
                                      _expandedIndices.remove(index);
                                    } else {
                                      _expandedIndices.add(index);
                                    }
                                  });
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(2),
                                  child: Icon(
                                    isExpanded ? Icons.info_rounded : Icons.info_outline_rounded,
                                    color: isExpanded ? const Color(0xFFFFD580) : Colors.white54,
                                    size: 19,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Expandable Panel with summary info (Right-aligned in RTL, No dark background box, clean small text, no emojis)
                    AnimatedCrossFade(
                      firstChild: const SizedBox(width: double.infinity),
                      secondChild: Padding(
                        padding: const EdgeInsets.only(top: 10, right: 4, left: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text(
                              'استاد راهنما: $teacherName',
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'جلسات و سرفصل‌ها: ${totalSessions > 0 ? "${totalSessions.toPersian()} جلسه آموزشی" : "${categoriesList.length.toPersian()} سرفصل"}',
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'وضعیت منزلگاه: ${isCompleted ? '۱۰۰٪ تکمیل شده' : (isCurrent ? 'در حال یادگیری' : 'قفل شده')}',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                color: isCurrent
                                    ? const Color(0xFFFFD580)
                                    : (isCompleted ? const Color(0xFF10B981) : Colors.white54),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ],
                        ),
                      ),
                      crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                      duration: const Duration(milliseconds: 250),
                    ),
                  ],
                ),
              ),
            ),

            // Badge overlay at top-right
            Positioned(
              top: -10,
              right: 18,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3.5),
                decoration: BoxDecoration(
                  gradient: isCurrent
                      ? const LinearGradient(
                          colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        )
                      : null,
                  color: isCurrent
                      ? null
                      : (isCompleted ? const Color(0xFF10B981) : const Color(0xFF28274A)),
                  borderRadius: BorderRadius.circular(12),
                  border: isCurrent ? null : Border.all(color: const Color(0xFF3A3A6A), width: 1.0),
                ),
                child: Text(
                  isLocked ? 'قفل' : (isCompleted ? 'تکمیل شده' : 'منزلگاه جاری'),
                  style: TextStyle(
                    color: isCurrent ? const Color(0xFF5A3114) : Colors.white,
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rotating animated gradient border widget for current station card
class _RotatingBorderCard extends StatefulWidget {
  final bool isCurrent;
  final Widget child;

  const _RotatingBorderCard({
    required this.isCurrent,
    required this.child,
  });

  @override
  State<_RotatingBorderCard> createState() => _RotatingBorderCardState();
}

class _RotatingBorderCardState extends State<_RotatingBorderCard> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );
    if (widget.isCurrent) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant _RotatingBorderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isCurrent && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.isCurrent && _controller.isAnimating) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isCurrent) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            stops: [0.0, 0.5, 1.0],
            colors: [
              Color(0xFF3A3A6A),
              Color(0xFF9292E2),
              Color(0xFF3A3A6A),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.35),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.all(1.2),
        child: widget.child,
      );
    }

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Container(
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: SweepGradient(
                center: Alignment.center,
                transform: GradientRotation(_controller.value * 2 * math.pi),
                colors: const [
                  Color(0xFF8D5B2C),
                  Color(0xFFFFE082),
                  Color(0xFFEAA835),
                  Color(0xFFFFD574),
                  Color(0xFF8D5B2C),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFEAA835).withValues(alpha: 0.35),
                  blurRadius: 16,
                  spreadRadius: 1.5,
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            padding: const EdgeInsets.all(1.8),
            child: widget.child,
          );
        },
      ),
    );
  }
}
