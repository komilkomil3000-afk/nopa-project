import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';
import '../widgets/pending_challenges_dialog.dart';
import '../widgets/nopa_notification_dialog.dart';
import 'class1/class1_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Set<int> _expandedIndices = {};
  bool _isLoading = true;
  int _selectedStationIndex = 0;
  Station? _selectedStationForClass1;
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
    if (_selectedStationForClass1 != null) {
      return Class1Screen(
        initialStation: _selectedStationForClass1,
        isEmbeddedInMain: true,
        onBack: () {
          if (mounted) {
            setState(() {
              _selectedStationForClass1 = null;
            });
          }
        },
      );
    }

    final user = Provider.of<AppRepository>(context).currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int totalStationNodes = _stations.isNotEmpty ? _stations.length : 6;
    final int activeUserStationIndex = (userLevelFrame - 1).clamp(0, totalStationNodes - 1);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
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

                // 2. Horizontal Station Selection & Progress Track Header (Starts at 0)
                _buildStationTrackHeader(
                  selectedStationIndex: _selectedStationIndex,
                  activeUserStationIndex: activeUserStationIndex,
                  userLevelFrame: userLevelFrame,
                  completedStationsCount: user.completedStationsCount,
                  totalNodes: totalStationNodes,
                ),
                const SizedBox(height: 16),

                // 3. Map list of stations
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
  Widget _buildStationTrackHeader({
    required int selectedStationIndex,
    required int activeUserStationIndex,
    required int userLevelFrame,
    required int completedStationsCount,
    required int totalNodes,
  }) {
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
        const SizedBox(height: 14),

        // Horizontal Nodes Track (Left to Right: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> Champion)
        SingleChildScrollView(
          clipBehavior: Clip.none,
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              height: 68,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  for (int i = 0; i < totalNodes; i++) ...[
                    // Station Node Circle
                    _buildStationNode(
                      index: i,
                      isSelected: i == selectedStationIndex,
                      currentStationIndex: activeUserStationIndex,
                      userLevelFrame: userLevelFrame,
                      completedStationsCount: completedStationsCount,
                      size: nodeSize,
                    ),

                    // Connecting Rails Track Segment between node i and node i+1 (or Champion)
                    _buildTrackConnector(
                      index: i,
                      currentStationIndex: selectedStationIndex,
                      userLevelFrame: userLevelFrame,
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
          margin: const EdgeInsets.only(left: 24, right: 24, top: 14, bottom: 12),
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
    required bool isSelected,
    required int currentStationIndex,
    required int userLevelFrame,
    required int completedStationsCount,
    required double size,
  }) {
    final bool isCurrent = isSelected;
    final bool isPassed = index < (userLevelFrame - 1) || index < completedStationsCount;
    final bool isFirstNext = index == currentStationIndex + 1;
    final bool isSecondNext = index == currentStationIndex + 2;

    Gradient gradient;
    Border border;
    List<BoxShadow>? boxShadow;

    if (isCurrent) {
      // Selected station: bright golden glow
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFFFBF42),
          Color(0xFFD68B18),
        ],
      );
      border = Border.all(color: const Color(0xFFFFE599), width: 1.8);
      boxShadow = [
        BoxShadow(
          color: const Color(0xFFEAA835).withValues(alpha: 0.55),
          blurRadius: 12,
          spreadRadius: 1,
        ),
      ];
    } else if (isPassed) {
      // Completed stations: Keep warm gold light and glow
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFE5A133),
          Color(0xFFC07F1C),
        ],
      );
      border = Border.all(color: const Color(0xFFFFD574), width: 1.3);
      boxShadow = [
        BoxShadow(
          color: const Color(0xFFD4973B).withValues(alpha: 0.4),
          blurRadius: 8,
          spreadRadius: 1,
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
      onTap: () {
        setState(() {
          _selectedStationIndex = index;
        });
        _scrollToStation(index);
      },
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
            style: const TextStyle(
              color: Colors.white,
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
    required int userLevelFrame,
    required double width,
  }) {
    final bool isPassed = index < (userLevelFrame - 1);
    final bool isGlowingSegment = index == currentStationIndex || isPassed;

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
              height: 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                gradient: LinearGradient(
                  colors: isPassed
                      ? [const Color(0xFFE5A133), const Color(0xFFC07F1C)]
                      : [const Color(0xFFFFB732), const Color(0x00FFB732)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFB732).withValues(alpha: 0.4),
                    blurRadius: 6,
                    spreadRadius: 0.5,
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

                        setState(() {
                          _selectedStationForClass1 = Station(
                            id: item['id'] ?? '',
                            title: stationTitle,
                            teacher: teacherName,
                            progress: stationProgress,
                            isLocked: isLocked,
                            isCurrent: isCurrent,
                            imageUrl: iconUrl,
                            classesCount: totalSessions > 0 ? '$totalSessions جلسه' : '${categoriesList.length} سرفصل',
                            orderIndex: index,
                          );
                        });
                      },
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // 1. Right in RTL: Rectangular Station Image (Proportional to A4 aspect ratio 1:1.414)
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
                              child: CachedNetworkImage(
                                imageUrl: ApiConstants.resolveImageUrl(iconUrl),
                                fit: BoxFit.cover,
                                memCacheWidth: 200,
                                memCacheHeight: 280,
                                color: isLocked ? Colors.black54 : null,
                                colorBlendMode: isLocked ? BlendMode.saturation : null,
                                placeholder: (context, url) => Container(
                                  color: const Color(0xFF28274A),
                                  alignment: Alignment.center,
                                  child: const CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF9292E2)),
                                ),
                                errorWidget: (context, url, error) => Container(
                                  color: const Color(0xFF28274A),
                                  child: const Icon(Icons.school, color: Colors.white30, size: 20),
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(width: 14),

                          // 2. Middle: Station Details & Number directly beside Title (Right-aligned in RTL)
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isGold
                                            ? const Color(0xFFFFD580)
                                            : const Color(0xFF9292E2).withValues(alpha: 0.25),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: isGold ? const Color(0xFFFFD580) : const Color(0xFF9292E2),
                                          width: 1,
                                        ),
                                      ),
                                      child: Text(
                                        '$index',
                                        style: TextStyle(
                                          color: isGold ? const Color(0xFF462306) : Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          fontFamily: AppTheme.fontFamily,
                                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
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
                                    ),
                                  ],
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

                          // 3. Left in RTL: Clean SVG Lock/Unlock Icon (No Circle Background behind it)
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
                        ],
                      ),
                    ),

                    // Expandable Panel with summary info (Right-aligned in RTL)
                    AnimatedCrossFade(
                      firstChild: const SizedBox(width: double.infinity),
                      secondChild: Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF28274A),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF3A3A6A), width: 1.0),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '👤 استاد راهنما: $teacherName',
                              textAlign: TextAlign.right,
                              style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: AppTheme.fontFamily),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '📚 جلسات و سرفصل‌ها: ${totalSessions > 0 ? "$totalSessions جلسه آموزشی" : "${categoriesList.length} سرفصل"}',
                              textAlign: TextAlign.right,
                              style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: AppTheme.fontFamily),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '📊 وضعیت منزلگاه: ${isCompleted ? '۱۰۰٪ تکمیل شده ✅' : (isCurrent ? 'در حال یادگیری ⚡' : 'قفل شده 🔒')}',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                color: isCurrent
                                    ? const Color(0xFFFFD580)
                                    : (isCompleted ? const Color(0xFF10B981) : Colors.white54),
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
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
