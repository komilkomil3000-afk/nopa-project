import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../../models/station.dart';
import '../../models/user_model.dart';
import '../../services/app_state_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/api_constants.dart';
import '../../services/api_service.dart';
import '../../widgets/pending_challenges_dialog.dart';
import '../../widgets/nopa_notification_dialog.dart';
import '../../widgets/custom_drawer.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../main.dart';
import '../chat_screen.dart';

/// Class 1 Screen (صفحه اطلاعات و توضیحات منزلگاه)
class Class1Screen extends StatefulWidget {
  const Class1Screen({super.key});

  @override
  State<Class1Screen> createState() => _Class1ScreenState();
}

/// Backwards compatibility alias
typedef StationDetailScreen = Class1Screen;

class _Class1ScreenState extends State<Class1Screen> {
  Station? _station;
  List<Map<String, dynamic>> _allStationsData = [];
  Map<String, List<Map<String, dynamic>>> _classCategories = {};
  List<Map<String, dynamic>> _allClips = [];
  int _currentClipIndex = 0;
  bool _isDescriptionExpanded = false;
  int _currentStationIndex = 0;

  // Station lore, descriptions, and statistics
  static const Map<int, Map<String, String>> _stationLore = {
    0: {
      'ordinalTitle': 'منزلگاه صفر',
      'fullTitle': 'منزلگاه صفر (راهنمای کاروان)',
      'desc':
          'اینجا منزلگاه صفر، نقطه آغازین سفر کاروان نپا است. کاروانسرایی برای آشنایی، دریافت توشه‌ی راه و شناخت قوانین پیمایش. در این ایستگاه مقدماتی، راهبران مسیر و همراهان کاروان خود را خواهید شناخت و آماده ورود به صحرای ماجراجویی می‌شوید.',
      'skillSessions': '۱ جلسه',
      'mediaSessions': '۲ جلسه',
      'animationCount': 'یک قسمت',
      'stayDuration': '۵ روز',
      'clipTitle': 'انیمیشن مقدماتی راهنمای کاروان (منزلگاه ۰)',
    },
    1: {
      'ordinalTitle': 'منزلگاه اول',
      'fullTitle': 'منزلگاه اول (کاروانسرای غبارگرفته)',
      'desc':
          'اینجا منزلگاه اول، جایی در مناطق حاشیه‌ای صحرای فراموشی است. کاروانسرای غبارگرفته‌ای که اکنون در آن اقامت گزیده‌ایم، همیشه مسافران تازه‌کار را غافلگیر می‌کند. دیوارهای اینجا همه از آیینه هایی ساخته شده‌اند که می‌توانند چیزی فراتر از ظاهر را نشان دهند. عمق فکر و علایق و آرزوهای ما. پیر آیینه گر، مرشد و استادی است که در این منزلگاه سکونت دارد. همه‌ی این آیینه های خارق‌العاده، به دست او ساخته شده‌اند...',
      'skillSessions': '۲ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': 'دو قسمت',
      'stayDuration': 'ده روز',
      'clipTitle': 'انیمیشن کاروانسرای غبارگرفته (منزلگاه ۱)',
    },
    2: {
      'ordinalTitle': 'منزلگاه دوم',
      'fullTitle': 'منزلگاه دوم (معدن زیرزمینی)',
      'desc':
          'اینجا منزلگاه دوم، در اعماق کوهستان‌های پر رمز و راز و معدن‌های باستانی است. جایی که سنگ‌های درخشان و ارزشمند در دل تاریکی نهفته‌اند. در این منزلگاه، مسافران یاد می‌گیرند که چگونه با تلاش و مهارت، گوهر استعدادها و توانمندی‌های خود را کشف و صیقل دهند.',
      'skillSessions': '۳ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': 'دو قسمت',
      'stayDuration': 'دوازده روز',
      'clipTitle': 'انیمیشن اسرار معدن زیرزمینی (منزلگاه ۲)',
    },
    3: {
      'ordinalTitle': 'منزلگاه سوم',
      'fullTitle': 'منزلگاه سوم (قلعه)',
      'desc':
          'اینجا منزلگاه سوم، قلعه‌ای با شکوه و استوار بر فراز صخره‌های کهن است. در این سنگر مستحکم، اعضای کاروان یاد می‌گیرند که چگونه در کنار یکدیگر به عنوان یک تیم متحد عمل کنند و در برابر چالش‌ها و بادهای سخت مقاومت ورزند.',
      'skillSessions': '۳ جلسه',
      'mediaSessions': '۵ جلسه',
      'animationCount': 'سه قسمت',
      'stayDuration': 'پانزده روز',
      'clipTitle': 'انیمیشن دفاع از قلعه کهن (منزلگاه ۳)',
    },
    4: {
      'ordinalTitle': 'منزلگاه چهارم',
      'fullTitle': 'منزلگاه چهارم (دهکده ساحلی)',
      'desc':
          'اینجا منزلگاه چهارم، دهکده‌ای آرام و پرامید در کنار ساحل دریای بیکران است. در این منزلگاه، اعضای کاروان مهارت‌های برقراری ارتباط، داستان‌پردازی و خلق آثار مشترک را تمرین می‌کنند تا یادگاری ماندگار از خود بر جای گذارند.',
      'skillSessions': '۴ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': 'دو قسمت',
      'stayDuration': 'ده روز',
      'clipTitle': 'انیمیشن رویاهای دهکده ساحلی (منزلگاه ۴)',
    },
    5: {
      'ordinalTitle': 'منزلگاه پنجم',
      'fullTitle': 'منزلگاه پنجم (فانوس دریایی)',
      'desc':
          'اینجا منزلگاه پنجم، فانوس دریایی فروزان و نقطه اوج سفر کاروان نپا است. نوری درخشان که افق‌های آینده را روشن می‌سازد. در این مقصد، مسافران ثمره تلاش‌ها و تجربیات خود را جشن گرفته و آماده رهبری مسیرهای آینده می‌شوند.',
      'skillSessions': '۴ جلسه',
      'mediaSessions': '۶ جلسه',
      'animationCount': 'چهار قسمت',
      'stayDuration': 'بیست روز',
      'clipTitle': 'انیمیشن روشنایی فانوس دریایی (منزلگاه ۵)',
    },
  };

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_station == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Station) {
        _station = args;
        _currentStationIndex = args.orderIndex;
      } else {
        _station = Station(
          id: '1',
          title: 'منزلگاه اول (کاروانسرای غبارگرفته)',
          teacher: 'پیر آیینه‌گر',
          progress: 0.0,
          isLocked: false,
          isCurrent: true,
          imageUrl: '',
          orderIndex: 1,
        );
        _currentStationIndex = 1;
      }
      _loadClassCategories();
    }
  }

  Future<void> _loadClassCategories() async {
    try {
      final stations = await HttpApiService().getStations();
      _allStationsData = List<Map<String, dynamic>>.from(stations);

      Map<String, dynamic> stationData = {};
      if (_allStationsData.isNotEmpty) {
        stationData = _allStationsData.firstWhere(
          (s) => (s['orderIndex'] == _currentStationIndex) || (s['id'] == _station?.id),
          orElse: () => _allStationsData.isNotEmpty ? _allStationsData[0] : {},
        );
      }

      final Map<String, List<Map<String, dynamic>>> map = {};
      final List<Map<String, dynamic>> clipsList = [];

      if (stationData.containsKey('categories') && stationData['categories'] != null) {
        final categoriesList = stationData['categories'] as List? ?? [];
        for (final item in categoriesList) {
          if (item is Map) {
            final cat = item as Map<String, dynamic>;
            final catTitle = cat['title']?.toString() ?? 'کلاس‌ها';
            final sessions = (cat['sessions'] as List?)?.map((s) => s as Map<String, dynamic>).toList() ?? [];
            map[catTitle] = sessions;

            for (final sess in sessions) {
              final clips = (sess['videoClips'] as List?)?.map((c) => c as Map<String, dynamic>).toList() ?? [];
              clipsList.addAll(clips);
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _classCategories = map;
          _allClips = clipsList;
          _currentClipIndex = 0;
        });
      }
    } catch (e) {
      debugPrint('Error loading station details: $e');
    }
  }

  void _switchStation(int index) {
    if (index == _currentStationIndex) return;
    setState(() {
      _currentStationIndex = index;
      _isDescriptionExpanded = false;

      final lore = _stationLore[index];
      _station = Station(
        id: index.toString(),
        title: lore?['fullTitle'] ?? 'منزلگاه $index',
        teacher: 'استاد منزلگاه',
        progress: 0.0,
        isLocked: false,
        isCurrent: true,
        imageUrl: '',
        orderIndex: index,
      );
    });
    _loadClassCategories();
  }

  bool _checkCanAccessContent(BuildContext context) {
    if (_station == null) return true;
    final appState = Provider.of<AppRepository>(context, listen: false);
    final isNewStation = _currentStationIndex > 0 && !_station!.isCompleted;
    if (isNewStation && appState.hasPendingChallenges) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('شما باید چالش‌هایتان را تکمیل کنید', style: TextStyle(fontFamily: AppTheme.fontFamily, fontWeight: FontWeight.bold)),
          backgroundColor: Colors.redAccent,
          duration: Duration(seconds: 3),
        ),
      );
      PendingChallengesDialog.show(context, appState.uncompletedChallengesCount);
      return false;
    }
    return true;
  }

  void _navigateToClass(String categoryKeyword) {
    if (!_checkCanAccessContent(context)) return;

    List<Map<String, dynamic>> targetSessions = [];
    for (var entry in _classCategories.entries) {
      if (entry.key.contains(categoryKeyword)) {
        targetSessions = entry.value;
        break;
      }
    }

    if (targetSessions.isEmpty && _classCategories.isNotEmpty) {
      targetSessions = _classCategories.values.first;
    }

    if (targetSessions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('جلسات $categoryKeyword برای این منزلگاه به زودی منتشر می‌شود.', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: const Color(0xFF28274A),
        ),
      );
      return;
    }

    Navigator.pushNamed(
      context,
      '/class2',
      arguments: {
        'classes': targetSessions,
        'initialIndex': 0,
      },
    );
  }

  void _navigateToChat() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const ChatScreen(
          title: 'ارتباط با راهبر',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lore = _stationLore[_currentStationIndex] ?? _stationLore[1]!;
    final user = Provider.of<AppRepository>(context).currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int totalStationNodes = _allStationsData.isNotEmpty ? _allStationsData.length : 6;
    final int activeUserStationIndex = (userLevelFrame - 1).clamp(0, totalStationNodes - 1);

    // Dynamic counts from categories or fallback lore
    int skillSessionsCount = 0;
    int mediaSessionsCount = 0;
    for (var entry in _classCategories.entries) {
      if (entry.key.contains('مهارت')) {
        skillSessionsCount += entry.value.length;
      } else if (entry.key.contains('رسانه')) {
        mediaSessionsCount += entry.value.length;
      }
    }

    final String skillText = skillSessionsCount > 0 ? '$skillSessionsCount جلسه' : (lore['skillSessions'] ?? '۲ جلسه');
    final String mediaText = mediaSessionsCount > 0 ? '$mediaSessionsCount جلسه' : (lore['mediaSessions'] ?? '۴ جلسه');
    final String animText = _allClips.isNotEmpty ? '${_allClips.length} قسمت' : (lore['animationCount'] ?? 'دو قسمت');
    final String stayText = lore['stayDuration'] ?? 'ده روز';

    final String currentClipTitle = _allClips.isNotEmpty && _currentClipIndex < _allClips.length
        ? (_allClips[_currentClipIndex]['title'] ?? lore['clipTitle'] ?? 'انیمیشن منزلگاه')
        : (lore['clipTitle'] ?? 'انیمیشن کاروانسرای غبارگرفته (منزلگاه ۱)');

    return Scaffold(
      backgroundColor: Colors.transparent,
      drawer: CustomDrawer(
        onTabSelected: (idx) {
          Navigator.pop(context);
          Navigator.pop(context);
          navigateToMainTab(idx);
        },
        currentIndex: 1,
        role: user.role,
      ),
      bottomNavigationBar: CustomBottomNavBar(
        currentIndex: 1,
        role: user.role,
        onTap: (idx) {
          Navigator.pop(context);
          navigateToMainTab(idx);
        },
      ),
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
          child: Column(
            children: [
              // 1. Top Bar with NOPA Logo, Back Arrow, Notifications & Drawer Menu
              _buildTopBar(user),

              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 2. Horizontal Station Selection & Progress Track Header
                      _buildStationTrackHeader(
                        currentStationIndex: _currentStationIndex,
                        activeUserStationIndex: activeUserStationIndex,
                        totalNodes: totalStationNodes,
                      ),

                      const SizedBox(height: 14),

                      // 3. Station Header: Description on Left & Station Card on Right (Home Screen Stroke Style)
                      _buildStationLoreHeader(lore),

                      const SizedBox(height: 20),

                      // 4. Class Information & Statistics Strip (Right-aligned, 2-line expandable on tap)
                      _buildStatsStrip(
                        skillText: skillText,
                        mediaText: mediaText,
                        animText: animText,
                        stayText: stayText,
                      ),

                      const SizedBox(height: 22),

                      // 5. Animation & Video Carousel Section (16:9 Full Horizontal Aspect Ratio with vedionot01.svg)
                      _buildAnimationCarouselSection(currentClipTitle),

                      const SizedBox(height: 22),

                      // 6. Action Buttons Styled with NOPA Logo Colors & Single-Line Fit
                      _buildActionButtonsRow(),

                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 1. Top Bar with NOPA Logo + Back Arrow underneath & Notifications + Drawer
  Widget _buildTopBar(UserModel user) {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, top: 10, bottom: 4),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Left: NOPA Text Logo with Gradient + Back Arrow directly under it
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
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
                const SizedBox(height: 4),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFF23223D),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: SvgPicture.asset(
                        'assets/svg_icons/back01.svg',
                        width: 16,
                        height: 16,
                        colorFilter: const ColorFilter.mode(
                          Color(0xFFC7B299),
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
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

  /// 2. Top Station Track Header matching MapScreen
  Widget _buildStationTrackHeader({
    required int currentStationIndex,
    required int activeUserStationIndex,
    required int totalNodes,
  }) {
    const double nodeSize = 40.0;
    const double trophySize = 52.0;

    return Column(
      children: [
        const SizedBox(height: 10),
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
        const SizedBox(height: 16),

        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              height: trophySize + 10,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  for (int i = 0; i < totalNodes; i++) ...[
                    _buildStationNode(
                      index: i,
                      isSelected: i == currentStationIndex,
                      currentStationIndex: activeUserStationIndex,
                      size: nodeSize,
                    ),
                    _buildTrackConnector(
                      index: i,
                      currentStationIndex: currentStationIndex,
                      width: 22.0,
                    ),
                  ],
                  _buildChampionBadge(trophySize),
                ],
              ),
            ),
          ),
        ),

        // Subtle gradient divider
        Container(
          height: 1,
          margin: const EdgeInsets.only(left: 14, right: 14, top: 16, bottom: 10),
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

  Widget _buildStationNode({
    required int index,
    required bool isSelected,
    required int currentStationIndex,
    required double size,
  }) {
    final bool isCurrent = isSelected;
    final bool isFirstNext = index == currentStationIndex + 1;
    final bool isSecondNext = index == currentStationIndex + 2;
    final bool isCompleted = index < currentStationIndex;

    Gradient gradient;
    Border border;
    List<BoxShadow>? boxShadow;

    if (isCurrent) {
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
      onTap: () => _switchStation(index),
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
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(height: 1.5, color: const Color(0xFF453F73)),
              const SizedBox(height: 4),
              Container(height: 1.5, color: const Color(0xFF453F73)),
            ],
          ),
          if (isGlowingSegment)
            Container(
              height: 5,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFFB732),
                    Color(0xFF8B6230),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFB732).withValues(alpha: 0.6),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildChampionBadge(double trophySize) {
    return Container(
      width: trophySize,
      height: trophySize,
      margin: const EdgeInsets.only(left: 4),
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

  /// 3. Station Lore Header: Text on Left (Right-aligned) & Home-styled Station Card on Right
  Widget _buildStationLoreHeader(Map<String, String> lore) {
    const double cardWidth = 126.0;
    const double cardHeight = 175.0;
    final String stationImage = _station?.imageUrl ?? '';
    final bool hasValidImg = stationImage.isNotEmpty && stationImage.startsWith('http') && !stationImage.contains('placeholder');
    final String ordinalTitle = lore['ordinalTitle'] ?? 'منزلگاه اول';
    final String fullDescription = lore['desc'] ?? '';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left in RTL: Text Title & Description (Right-aligned text)
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                // Title (Right-aligned)
                Text(
                  ordinalTitle,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 8),

                // Description text with Expand / Collapse
                if (!_isDescriptionExpanded) ...[
                  // Collapsed: Constrained to card height with "بیشتر" button
                  SizedBox(
                    height: cardHeight - 48,
                    child: Text(
                      fullDescription,
                      textAlign: TextAlign.right,
                      maxLines: 5,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFD3D0E3),
                        fontSize: 11.5,
                        height: 1.6,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _isDescriptionExpanded = true),
                    child: const Padding(
                      padding: EdgeInsets.only(top: 2.0),
                      child: Text(
                        'بیشتر...',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Color(0xFFF4DCC5),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                ] else ...[
                  // Expanded full text
                  Text(
                    fullDescription,
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      color: Color(0xFFD3D0E3),
                      fontSize: 11.5,
                      height: 1.6,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => setState(() => _isDescriptionExpanded = false),
                    child: const Text(
                      'بستن (کمتر)',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: Color(0xFFFFD574),
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(width: 14),

          // Right in RTL: Station Card (Matching Home Screen StationCard Stroke & Shape)
          Container(
            width: cardWidth,
            height: cardHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
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
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.all(1.2), // Gradient border stroke width
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18.8),
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
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18.8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Upper Area: Image / imagenot01.svg
                    Expanded(
                      child: Container(
                        color: const Color(0xFF2E2E50),
                        child: hasValidImg
                            ? CachedNetworkImage(
                                imageUrl: ApiConstants.resolveImageUrl(stationImage),
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(
                                  color: const Color(0xFF2E2E50),
                                  alignment: Alignment.center,
                                  child: SvgPicture.asset(
                                    'assets/svg_icons/imagenot01.svg',
                                    width: 44,
                                    height: 44,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                                errorWidget: (context, url, error) => Container(
                                  color: const Color(0xFF2E2E50),
                                  alignment: Alignment.center,
                                  child: SvgPicture.asset(
                                    'assets/svg_icons/imagenot01.svg',
                                    width: 44,
                                    height: 44,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              )
                            : Center(
                                child: SvgPicture.asset(
                                  'assets/svg_icons/imagenot01.svg',
                                  width: 44,
                                  height: 44,
                                  fit: BoxFit.contain,
                                ),
                              ),
                      ),
                    ),

                    // 2. Stroke divider line
                    Container(
                      height: 1.2,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          stops: [0.0, 0.5, 1.0],
                          colors: [
                            Color(0xFF3A3A6A),
                            Color(0xFF9292E2),
                            Color(0xFF3A3A6A),
                          ],
                        ),
                      ),
                    ),

                    // 3. Bottom Info Bar: Number & Title
                    Container(
                      height: 42,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Directionality(
                        textDirection: TextDirection.rtl,
                        child: Row(
                          children: [
                            // Station Number
                            Text(
                              '$_currentStationIndex',
                              style: const TextStyle(
                                color: Color(0xFF9292E2),
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                            const SizedBox(width: 6),
                            // Station Title
                            Expanded(
                              child: Text(
                                ordinalTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                  color: Color(0xFFF4EFEA),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  fontFamily: AppTheme.fontFamily,
                                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 4. Class Information & Statistics Strip (Right-aligned, 2 lines on tap)
  Widget _buildStatsStrip({
    required String skillText,
    required String mediaText,
    required String animText,
    required String stayText,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem('کلاس مهارتی', skillText),
            _buildVerticalDivider(),
            _buildStatItem('کلاس رسانه‌ای', mediaText),
            _buildVerticalDivider(),
            _buildStatItem('انیمیشن', animText),
            _buildVerticalDivider(),
            _buildStatItem('زمان اقامت', stayText),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String title, String subtitle) {
    return Expanded(
      child: Tooltip(
        message: '$title: $subtitle',
        child: InkWell(
          onTap: () {
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  '$title: $subtitle',
                  style: const TextStyle(fontFamily: AppTheme.fontFamily, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.right,
                ),
                backgroundColor: const Color(0xFF2D2E4B),
                duration: const Duration(seconds: 2),
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2.0, vertical: 2.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  textAlign: TextAlign.right,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFB3B0C7),
                    fontSize: 11,
                    fontWeight: FontWeight.normal,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(
      width: 1,
      height: 30,
      color: const Color(0xFF534E7E).withValues(alpha: 0.7),
    );
  }

  /// 5. Animation / Video Clip Preview with Large 16:9 Aspect Ratio & vedionot01.svg
  Widget _buildAnimationCarouselSection(String clipTitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'انیمیشن هایی که باید ببینید',
          textAlign: TextAlign.right,
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
        const SizedBox(height: 12),

        // Carousel Video Box with Large Horizontal 16:9 Aspect Ratio
        Row(
          children: [
            // Left Chevron
            IconButton(
              onPressed: _allClips.length > 1 && _currentClipIndex > 0
                  ? () => setState(() => _currentClipIndex--)
                  : null,
              icon: Icon(
                Icons.chevron_left_rounded,
                color: _allClips.length > 1 && _currentClipIndex > 0 ? Colors.white70 : Colors.white24,
                size: 32,
              ),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),

            // Video Preview Box strictly 16:9
            Expanded(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: GestureDetector(
                  onTap: () => _navigateToClass('رسانه'),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFF3F3B66),
                          Color(0xFF282648),
                        ],
                      ),
                      border: Border.all(
                        color: const Color(0xFF555088),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.45),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          color: const Color(0xFF524C83).withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Center(
                          child: SvgPicture.asset(
                            'assets/svg_icons/vedionot01.svg',
                            width: 38,
                            height: 38,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Right Chevron
            IconButton(
              onPressed: _allClips.length > 1 && _currentClipIndex < _allClips.length - 1
                  ? () => setState(() => _currentClipIndex++)
                  : null,
              icon: Icon(
                Icons.chevron_right_rounded,
                color: _allClips.length > 1 && _currentClipIndex < _allClips.length - 1 ? Colors.white70 : Colors.white24,
                size: 32,
              ),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          ],
        ),

        const SizedBox(height: 8),

        // Caption text below video (Smaller size as requested)
        Text(
          clipTitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF9D99B8),
            fontSize: 10.5,
            fontWeight: FontWeight.w400,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ],
    );
  }

  /// 6. Action Buttons Styled with NOPA Gradient Colors and Single-Line Fit
  Widget _buildActionButtonsRow() {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        children: [
          // 1. ورود به کلاس مهارتی
          Expanded(
            child: _buildActionButton(
              title: 'ورود به کلاس مهارتی',
              onTap: () => _navigateToClass('مهارت'),
            ),
          ),
          const SizedBox(width: 6),

          // 2. ورود به کلاس رسانه‌ای
          Expanded(
            child: _buildActionButton(
              title: 'ورود به کلاس رسانه‌ای',
              onTap: () => _navigateToClass('رسانه'),
            ),
          ),
          const SizedBox(width: 6),

          // 3. ارتباط با راهبر
          Expanded(
            child: _buildActionButton(
              title: 'ارتباط با راهبر',
              onTap: _navigateToChat,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required String title,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2835),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: const Color(0xFFC09268).withValues(alpha: 0.85),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFF4DCC5),
              fontSize: 10.5,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      ),
    );
  }
}
