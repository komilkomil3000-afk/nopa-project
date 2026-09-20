import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';
import '../widgets/pending_challenges_dialog.dart';
import '../widgets/nopa_notification_dialog.dart';

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
                    orElse: () => <String, dynamic>{},
                  );
                  if (progressRecord['isWatched'] == true || progressRecord['quizPassed'] == true) {
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
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int totalStationNodes = _stations.isNotEmpty ? _stations.length : 6;
    final int currentStationIndex = (userLevelFrame - 1).clamp(0, totalStationNodes - 1);

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchStationsData,
          color: const Color(0xFFCD8449),
          child: SingleChildScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Top Bar with NOPA Logo, Notifications & Drawer Menu
                _buildTopBar(user),

                // 2. Horizontal Station Selection & Progress Track Header
                _buildStationTrackHeader(currentStationIndex, totalStationNodes),

                // 3. Overall Progress Summary Card
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
                  child: _buildOverallProgressCard(progress, progressPercentText),
                ),
                const SizedBox(height: 16),

                // 4. Map list of stations
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
                                style: TextStyle(color: Colors.white60, fontFamily: AppTheme.fontFamily),
                              ),
                            ),
                          )
                        : Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20.0),
                            child: ListView.separated(
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
                            ),
                          )),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Top Bar matching Home Page: NOPA Logo (Left) + Notification Bell & Drawer Menu (Right)
  Widget _buildTopBar(UserModel? user) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Left: NOPA Text Logo with Gradient (Darker at bottom, lighter at top)
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [
                  Color(0xFFC09268),
                  Color(0xFFF4DCC5),
                ],
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
              ).createShader(bounds),
              child: const Text(
                'NOPA',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ),

            // Right: Notification Bell Button + Drawer Hamburger Menu
            Row(
              children: [
                Consumer<AppRepository>(
                  builder: (context, repository, _) {
                    final count = repository.unreadNotificationsCount;
                    final bool hasUnread = count > 0;

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          repository.fetchNotifications();
                          NopaNotificationDialog.show(context);
                        },
                        borderRadius: BorderRadius.circular(22),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: const BoxDecoration(
                                color: Color(0xFF23223D),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.notifications_none_rounded,
                                  color: Color(0xFFC7B299),
                                  size: 23,
                                ),
                              ),
                            ),
                            if (hasUnread)
                              Positioned(
                                right: 0,
                                top: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEF4444),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF23223D), width: 1.5),
                                  ),
                                  child: Center(
                                    child: Text(
                                      count > 9 ? '+9' : '$count',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                        height: 1,
                                        fontFamily: AppTheme.fontFamily,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(width: 12),
                Builder(
                  builder: (ctx) => Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => Scaffold.of(ctx).openDrawer(),
                      borderRadius: BorderRadius.circular(22),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: const BoxDecoration(
                          color: Color(0xFF23223D),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.menu_rounded,
                            color: Color(0xFFC7B299),
                            size: 22,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Top Progress Track Header with Glowing Active Station, Faded Next Steps, and Champion Trophy Badge
  Widget _buildStationTrackHeader(int currentStationIndex, int totalNodes) {
    const double nodeSize = 40.0;
    const double trophySize = 52.0;

    return Column(
      children: [
        const SizedBox(height: 14),
        // Title: "منزلگاه را انتخاب کنید"
        const Text(
          'منزلگاه را انتخاب کنید',
          style: TextStyle(
            color: Color(0xFFEDE8F5),
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 18),

        // Horizontal Nodes Track (Left to Right: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> Champion)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              height: trophySize + 10,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  for (int i = 0; i < totalNodes; i++) ...[
                    // Station Node Circle
                    _buildStationNode(
                      index: i,
                      currentStationIndex: currentStationIndex,
                      size: nodeSize,
                    ),

                    // Connecting Rails Track Segment between node i and node i+1 (or Champion)
                    _buildTrackConnector(
                      index: i,
                      currentStationIndex: currentStationIndex,
                      width: 22.0,
                    ),
                  ],

                  // Champion Win Trophy Badge (champun01.svg) at the end of the track
                  _buildChampionBadge(trophySize),
                ],
              ),
            ),
          ),
        ),

        // Subtle gradient divider below the track
        Container(
          height: 1,
          margin: const EdgeInsets.only(left: 24, right: 24, top: 18, bottom: 12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.white.withValues(alpha: 0.0),
                Colors.white.withValues(alpha: 0.12),
                Colors.white.withValues(alpha: 0.0),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Individual Station Node with Dynamic Styling Based on Distance from Current Station
  Widget _buildStationNode({
    required int index,
    required int currentStationIndex,
    required double size,
  }) {
    final bool isCurrent = index == currentStationIndex;
    final bool isFirstNext = index == currentStationIndex + 1;
    final bool isSecondNext = index == currentStationIndex + 2;
    final bool isCompleted = index < currentStationIndex;

    Gradient gradient;
    Border border;
    List<BoxShadow>? boxShadow;

    if (isCurrent) {
      // Current active station: Glowing bright golden/amber with soft aura
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFEAA835),
          Color(0xFFC7841F),
        ],
      );
      border = Border.all(color: const Color(0xFFFFD574), width: 1.5);
      boxShadow = [
        BoxShadow(
          color: const Color(0xFFEAA835).withValues(alpha: 0.55),
          blurRadius: 16,
          spreadRadius: 2,
        ),
        BoxShadow(
          color: const Color(0xFFC7841F).withValues(alpha: 0.35),
          blurRadius: 24,
          spreadRadius: 4,
        ),
      ];
    } else if (isFirstNext) {
      // 1 step next: Medium warm bronze/gold tint
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFA57C46),
          Color(0xFF8B6230),
        ],
      );
      border = Border.all(color: const Color(0xFFC9985E), width: 1.2);
    } else if (isSecondNext) {
      // 2 steps next: Darker bronze tint
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF755530),
          Color(0xFF5A3E20),
        ],
      );
      border = Border.all(color: const Color(0xFF906D44), width: 1.2);
    } else if (isCompleted) {
      // Previously completed stations: Amber/Gold with warm finish
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFD4973B),
          Color(0xFFB57822),
        ],
      );
      border = Border.all(color: const Color(0xFFFFD574), width: 1.2);
    } else {
      // Subsequent locked stations: Dark purple matching home station box style
      gradient = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF38355F),
          Color(0xFF2B284E),
        ],
      );
      border = Border.all(color: const Color(0xFF5C578F), width: 1.2);
    }

    return GestureDetector(
      onTap: () => _scrollToStation(index),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: gradient,
          border: border,
          boxShadow: boxShadow,
        ),
        child: Center(
          child: Text(
            '$index',
            style: TextStyle(
              color: isCurrent || isCompleted
                  ? Colors.white
                  : (isFirstNext
                      ? Colors.white.withValues(alpha: 0.95)
                      : (isSecondNext
                          ? Colors.white.withValues(alpha: 0.85)
                          : Colors.white.withValues(alpha: 0.7))),
              fontSize: 14,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      ),
    );
  }

  /// Connecting Horizontal Rail Track Segment between Stations
  Widget _buildTrackConnector({
    required int index,
    required int currentStationIndex,
    required double width,
  }) {
    final bool isGlowingSegment = index == currentStationIndex;

    return SizedBox(
      width: width,
      height: 14,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Double rail horizontal lines
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 1.5,
                color: const Color(0xFF453F73),
              ),
              const SizedBox(height: 4),
              Container(
                height: 1.5,
                color: const Color(0xFF453F73),
              ),
            ],
          ),

          // Glowing amber line segment transitioning away from current active node
          if (isGlowingSegment)
            Container(
              height: 5,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2.5),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFEAA835),
                    Color(0x00EAA835),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEAA835).withValues(alpha: 0.5),
                    blurRadius: 8,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// End-of-track Champion Victory Badge with SVG `champun01.svg`
  Widget _buildChampionBadge(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF3C79E),
            Color(0xFFDCA472),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFDCA472).withValues(alpha: 0.45),
            blurRadius: 16,
            spreadRadius: 1,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: SvgPicture.asset(
          'assets/svg_icons/champun01.svg',
          width: 26,
          height: 26,
          colorFilter: const ColorFilter.mode(
            Color(0xFF5A3114),
            BlendMode.srcIn,
          ),
        ),
      ),
    );
  }

  Widget _buildOverallProgressCard(double progress, String progressPercentText) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
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
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
              ),
            ],
          ),
          const SizedBox(height: 12),
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

    final String stationTitle = Station.resolveTitle(item['title']?.toString(), index);
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

                    Navigator.pushNamed(
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
                                fontFamily: AppTheme.fontFamily,
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
                                fontFamily: AppTheme.fontFamily,
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
                          child: CachedNetworkImage(
                            imageUrl: ApiConstants.resolveImageUrl(iconUrl),
                            fit: BoxFit.cover,
                            color: isLocked ? Colors.black54 : null,
                            colorBlendMode: isLocked ? BlendMode.saturation : null,
                            placeholder: (context, url) => Container(
                              color: const Color(0xFF160E2A),
                              alignment: Alignment.center,
                              child: const CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6)),
                            ),
                            errorWidget: (context, url, error) => Container(
                              color: Colors.white10,
                              child: const Icon(Icons.school, color: Colors.white30, size: 20),
                            ),
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
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: AppTheme.fontFamily),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📚 جلسات و سرفصل‌ها: ${totalSessions > 0 ? "$totalSessions جلسه آموزشی" : "${categoriesList.length} سرفصل"}',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: AppTheme.fontFamily),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '📊 وضعیت منزلگاه: ${isCompleted ? '۱۰۰٪ تکمیل شده ✅' : (isCurrent ? 'در حال یادگیری ⚡' : 'قفل شده 🔒')}',
                          style: TextStyle(color: accentColor, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
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
                            style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: AppTheme.fontFamily),
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
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
