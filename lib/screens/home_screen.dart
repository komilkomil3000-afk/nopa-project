import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import '../models/station.dart';
import '../widgets/education_calendar.dart';
import '../widgets/home_challenges_section.dart';
import '../widgets/station_card.dart';
import '../widgets/nopa_notification_dialog.dart';
import '../widgets/pending_challenges_dialog.dart';
import '../main.dart'; // For MainScreenState

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _banners = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        HttpApiService().getStations(),
        HttpApiService().getBanners(position: 'home_top'),
      ]);
      if (mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(results[0] as List);
          _banners = List<Map<String, dynamic>>.from(results[1] as List);
          _isLoading = false;
        });
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
        Provider.of<AppRepository>(context, listen: false).refreshUser();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'خطا در دریافت اطلاعات';
          _isLoading = false;
        });
      }
    }
  }

  /// Top Bar: NOPA text on the left, Notification Bell & Menu button on the right
  Widget _buildTopBar(UserModel? user) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Left: NOPA Text Logo with ChochoAuraDemo Font and C09268 to F4DCC5 Gradient (Darker at bottom, lighter at top)
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

            // Right: Notification Bell Button (Brown/Gold matching NOPA text) + Drawer Hamburger Menu
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
                          Navigator.pushNamed(context, '/notifications');
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
                                      count > 9 ? '+۹' : count.toPersian(),
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

  /// Banner Slider Carousel: Compact height (~155px), peek adjacent banners on sides, and dot indicators
  Widget _buildBannerSection() {
    return _HomeBannerCarousel(banners: _banners);
  }

  final Set<String> _expandedInfoTitles = {};

  /// 4-Column User & Caravan Summary Strip (مسافر, کاروان, راهبر, منزلگاه کنونی) - Right-aligned & Tap-to-expand
  Widget _buildUserInfoStrip(UserModel? user) {
    final String currentStationTitle = '۱. ${Station.resolveTitle(_stations.isNotEmpty ? _stations[0]['title']?.toString() : null, 0)}';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18.0),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: _buildInfoColumn(
                  title: 'مسافر',
                  value: user?.name ?? 'کمیل عباس',
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'کاروان',
                  value: user?.caravanName ?? 'شماره پنجم',
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'راهبر',
                  value: user?.caravanMentor ?? 'رضا جلالی',
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'منزلگاه کنونی',
                  value: currentStationTitle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoColumn({required String title, required String value}) {
    final bool isExpanded = _expandedInfoTitles.contains(title);

    return GestureDetector(
      onTap: () {
        setState(() {
          if (isExpanded) {
            _expandedInfoTitles.remove(title);
          } else {
            _expandedInfoTitles.add(title);
          }
        });
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start, // Right aligned in RTL
        children: [
          Text(
            title,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 12.5,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            textAlign: TextAlign.right,
            maxLines: isExpanded ? 3 : 1,
            overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFB5B3C8),
              fontSize: 10.5,
              height: 1.25,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ],
      ),
    );
  }

  int _selectedAssetIndex = 0;

  /// Assets Strip: Horizontal scrollable pills with badge numbers (1, 2, 3, 4) matching screenshot
  Widget _buildAssetsSection(UserModel? user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'سرمایه ها',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 44,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                _buildAssetPill(
                  badgeNumber: '۱',
                  label: 'زریک',
                  value: (user?.zarik ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۲',
                  label: 'بیرق',
                  value: (user?.beyragh ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 1,
                  onTap: () => setState(() => _selectedAssetIndex = 1),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۳',
                  label: 'نخ',
                  value: (user?.nakh ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۴',
                  label: 'فرش',
                  value: (user?.farsh ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 3,
                  onTap: () => setState(() => _selectedAssetIndex = 3),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAssetPill({
    required String badgeNumber,
    required String label,
    required String value,
    required bool isGold,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 130),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: isGold
              ? const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: [0.0, 0.5, 1.0],
                  colors: [
                    Color(0xFF8D5B2C),
                    Color(0xFFFFD580),
                    Color(0xFF8D5B2C),
                  ],
                )
              : const LinearGradient(
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
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(1.2), // Gradient border matching StationCard
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20.8),
            gradient: isGold
                ? const LinearGradient(
                    colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: isGold ? null : const Color(0xFF28274A),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Right: Circular Badge with Number 1, 2, 3, 4
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: isGold ? const Color(0xFF653A18) : const Color(0xFF8B88E8),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      badgeNumber,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Middle: Label (زریک, بیرق, نخ, فرش)
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 16),
                // Left: Value (0, 100, etc.)
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppRepository>(context);
    final user = appState.currentUser;

    if (_isLoading) {
      return Container(
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: const Center(child: CircularProgressIndicator(color: Color(0xFFCD8449))),
      );
    }

    if (_errorMessage != null) {
      return Container(
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
              const SizedBox(height: 16),
              Text(_errorMessage!, style: const TextStyle(fontSize: 16, color: Colors.white, fontFamily: AppTheme.fontFamily)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFCD8449),
                  foregroundColor: Colors.white,
                ),
                child: const Text('تلاش مجدد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: AppColors.screenBackgroundGradient,
        image: DecorationImage(
          image: AssetImage('assets/images/login_bg.png'),
          fit: BoxFit.cover,
        ),
      ),
      child: RefreshIndicator(
        onRefresh: _fetchData,
        color: const Color(0xFFCD8449),
        backgroundColor: const Color(0xFF231C38),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Top Bar: NOPA Logo & Notification Bell + Menu Button
                _buildTopBar(user),

                const SizedBox(height: 12),

                // 2. Banner Slider Carousel with Dots
                _buildBannerSection(),

                const SizedBox(height: 16),

                // 3. User & Caravan Information Strip
                _buildUserInfoStrip(user),

                const SizedBox(height: 18),

                // 4. Assets Section (سرمایه‌ها)
                _buildAssetsSection(user),

                const SizedBox(height: 22),

              // 5. Educational Stations Carousel (منزلگاه‌ها)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'منزلگاه ها',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          context.findAncestorStateOfType<MainScreenState>()?.setIndex(1); // 1 is MapScreen
                        },
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(40, 30),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          'همه',
                          style: TextStyle(
                            color: Color(0xFFB5B3C8),
                            fontSize: 13.5,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 230,
                child: _stations.isEmpty
                    ? const Center(child: Text('منزلگاهی یافت نشد', style: TextStyle(color: Colors.white54, fontFamily: AppTheme.fontFamily)))
                    : Directionality(
                        textDirection: TextDirection.rtl,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemExtent: 164.0,
                          itemCount: _stations.length,
                          itemBuilder: (context, index) {
                            final stationMap = _stations[index];
                            final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
                            bool isLocked = index > 0 && (index + 1) > userLevelFrame && index > user.completedStationsCount;
                            bool isCurrent = (index + 1) == userLevelFrame || (index == 0 && userLevelFrame <= 1);
                            bool isCompleted = (index + 1) < userLevelFrame || index < user.completedStationsCount;

                            final String teacherName = stationMap['instructors']?.toString() ??
                                stationMap['subtitle']?.toString() ??
                                stationMap['teacher']?.toString() ??
                                'استاد کاروان نپا';
                            final String iconUrl = (stationMap['iconUrl'] != null && stationMap['iconUrl'].toString().startsWith('http'))
                                ? stationMap['iconUrl'].toString()
                                : ((stationMap['imageUrl'] != null && stationMap['imageUrl'].toString().startsWith('http'))
                                    ? stationMap['imageUrl'].toString()
                                    : 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=400');

                            final station = Station(
                              id: stationMap['id'] ?? index.toString(),
                              title: Station.resolveTitle(stationMap['title']?.toString(), index),
                              subtitle: stationMap['subtitle']?.toString(),
                              teacher: teacherName,
                              progress: isCompleted ? 1.0 : (isCurrent ? 0.3 : 0.0),
                              isLocked: isLocked,
                              isCurrent: isCurrent,
                              imageUrl: iconUrl,
                              orderIndex: index,
                            );

                            return StationCard(
                              station: station,
                              onTap: () async {
                                if (isLocked) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('این منزلگاه هنوز بازگشایی نشده است', style: TextStyle(fontFamily: 'Vazirmatn'))),
                                  );
                                  return;
                                }

                                final isNewStation = index > 0 && !isCompleted;
                                if (isNewStation && appState.hasPendingChallenges) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('شما باید چالش‌هایتان را تکمیل کنید', style: TextStyle(fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold)),
                                      backgroundColor: Colors.redAccent,
                                      duration: Duration(seconds: 3),
                                    ),
                                  );
                                  PendingChallengesDialog.show(context, appState.uncompletedChallengesCount);
                                  return;
                                }

                                final result = await Navigator.pushNamed(context, '/station_detail', arguments: station);
                                if (result is int && context.mounted) {
                                  navigateToMainTab(result);
                                }
                              },
                            );
                          },
                        ),
                      ),
              ),
              const SizedBox(height: 24),

              // 4. Jalali Education Calendar
              const EducationCalendar(),
              const SizedBox(height: 24),

              // 5. Special Challenges Section (چالش‌های مخصوص تو)
              const HomeChallengesSection(),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    ),
  );
}
}

/// Isolated Banner Carousel with internal timer and RepaintBoundary to avoid parent screen rebuilds
class _HomeBannerCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> banners;

  const _HomeBannerCarousel({required this.banners});

  @override
  State<_HomeBannerCarousel> createState() => _HomeBannerCarouselState();
}

class _HomeBannerCarouselState extends State<_HomeBannerCarousel> {
  late final PageController _bannerPageCtrl;
  int _currentBannerIndex = 0;
  Timer? _bannerAutoScrollTimer;

  @override
  void initState() {
    super.initState();
    _bannerPageCtrl = PageController(viewportFraction: 0.88);
    _startBannerAutoScroll();
  }

  void _startBannerAutoScroll() {
    _bannerAutoScrollTimer?.cancel();
    _bannerAutoScrollTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted || !_bannerPageCtrl.hasClients) return;
      final int totalPages = widget.banners.isNotEmpty ? widget.banners.length : 3;
      final int nextIndex = (_currentBannerIndex + 1) % totalPages;
      _bannerPageCtrl.animateToPage(
        nextIndex,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _bannerAutoScrollTimer?.cancel();
    _bannerPageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> bannerList = widget.banners.isNotEmpty
        ? widget.banners
        : const [
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
          ];

    return RepaintBoundary(
      child: Column(
        children: [
          SizedBox(
            height: 155,
            child: PageView.builder(
              controller: _bannerPageCtrl,
              itemCount: bannerList.length,
              onPageChanged: (index) {
                setState(() => _currentBannerIndex = index);
              },
              itemBuilder: (context, index) {
                final item = bannerList[index];
                final String? imageUrl = item['imageUrl'] != null && item['imageUrl'].toString().trim().isNotEmpty
                    ? ApiConstants.resolveImageUrl(item['imageUrl'].toString())
                    : null;
                final String assetPath = item['assetImage']?.toString() ?? 'assets/images/banners/banner1.jpg';

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: imageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                            memCacheWidth: 600,
                            memCacheHeight: 350,
                            placeholder: (context, url) => Container(
                              color: const Color(0xFF231C38),
                              child: const Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFCD8449),
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) => Image.asset(
                              assetPath,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                            ),
                          )
                        : Image.asset(
                            assetPath,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                            errorBuilder: (context, error, stackTrace) => Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Color(0xFF6B3A1E), Color(0xFF381F14)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                              ),
                            ),
                          ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                bannerList.length,
                (index) {
                  final bool isActive = _currentBannerIndex == index;

                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: isActive ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFFCD8449)
                          : Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
