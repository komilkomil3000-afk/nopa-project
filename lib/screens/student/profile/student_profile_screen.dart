import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/contact_us_dialog.dart';
import 'package:nopa_app/widgets/logout_dialog.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/screens/student/profile/student_certificates_screen.dart';
import 'package:nopa_app/screens/student/profile/student_edit_profile_screen.dart';
import 'package:nopa_app/screens/mentor/profile/mentor_caravans_roster_screen.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/station_progress_stepper.dart';

class StudentProfileScreen extends StatefulWidget {
  const StudentProfileScreen({super.key});

  @override
  State<StudentProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<StudentProfileScreen> {
  List<Map<String, dynamic>> _lmsStations = [];
  List<Map<String, dynamic>> _userProgressList = [];

  @override
  void initState() {
    super.initState();
    _loadLmsProgressData();
  }

  Future<void> _loadLmsProgressData() async {
    try {
      final stations = await HttpApiService().getStations();
      final progress = await HttpApiService().getUserProgress();
      if (mounted) {
        setState(() {
          _lmsStations = stations.cast<Map<String, dynamic>>();
          _userProgressList = progress.cast<Map<String, dynamic>>();
        });
      }
    } catch (_) {}
  }

  void _openEditProfile(UserModel user) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => EditProfileScreen(user: user),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final currentUser = repository.currentUser;
    final bool isMentor = currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor;

    return RefreshIndicator(
      onRefresh: () => Provider.of<AppRepository>(context, listen: false).refreshUser(),
      color: const Color(0xFFCD8449),
      backgroundColor: const Color(0xFF231C38),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 10),

            // 1. User Info Card (Avatar with double ring & pencil badge on right, Name & Role/Caravan on left)
            _buildUserHeaderCard(currentUser, isMentor: isMentor),

            const SizedBox(height: 16),

            // 2. Group 1:
            // For Mentor: ویرایش اطلاعات + کاروان ها و اعضا
            // For Student: ویرایش اطلاعات + پیام ها
            if (isMentor) ...[
              _buildProfileMenuItem(
                title: 'ویرایش اطلاعات',
                svgAsset: 'assets/svg_icons/setting01.svg',
                fallbackIcon: Icons.settings_rounded,
                onTap: () => _openEditProfile(currentUser),
              ),
              _buildProfileMenuItem(
                title: 'کاروان ها و اعضا',
                svgAsset: 'assets/svg_icons/widow01.svg',
                fallbackIcon: Icons.grid_view_rounded,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const MentorMembersScreen()),
                ),
              ),
            ] else ...[
              _buildProfileMenuItem(
                title: 'ویرایش اطلاعات',
                svgAsset: 'assets/svg_icons/setting01.svg',
                fallbackIcon: Icons.settings_rounded,
                onTap: () => _openEditProfile(currentUser),
              ),
              _buildProfileMenuItem(
                title: 'پیام ها',
                svgAsset: '',
                fallbackIcon: Icons.notifications_none_rounded,
                onTap: () => Navigator.pushNamed(context, '/notifications'),
              ),
            ],

            const SizedBox(height: 4),
            _buildSubtleDivider(),
            const SizedBox(height: 4),

            // 3. Group 2:
            // For Mentor: کارنامه و دستاوردها + تیکت های شما
            // For Student: کارنامه و دستاوردها + گواهی ها + تیکت های شما
            _buildGroupOneList(currentUser, isMentor: isMentor),

            const SizedBox(height: 4),
            _buildSubtleDivider(),
            const SizedBox(height: 4),

            // 4. Group 3: داستان + پشتیبانی و ارتباط با ما + خروج از حساب کاربری
            _buildGroupTwoList(currentUser),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  /// User Info Card: Avatar with edit pencil badge on right, Name & Subtitle on left
  Widget _buildUserHeaderCard(UserModel user, {bool isMentor = false}) {
    final String displayName = user.name.isNotEmpty ? user.name : (isMentor ? 'رضا جلالی' : 'کمیل عباس');
    final String subtitle = isMentor
        ? (user.role == UserRole.superMentor ? 'سرراهبر' : 'مربی')
        : ((user.caravanName != null && user.caravanName!.trim().isNotEmpty)
            ? 'عضو کاروان ${user.caravanName}'
            : 'عضو کاروان شماره پنجم');

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Right: Circular Avatar with Double Ring and Pencil Edit Badge
          GestureDetector(
            onTap: () => _openEditProfile(user),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Outer ring
                Container(
                  width: 86,
                  height: 86,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF6B68A8).withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF6462A2),
                    ),
                    child: Center(
                      child: SafeAvatar(
                        radius: 36,
                        imageUrl: user.avatarUrl,
                        name: displayName,
                        backgroundColor: Colors.transparent,
                      ),
                    ),
                  ),
                ),

                // Pencil Edit Badge at bottom-left in RTL
                Positioned(
                  bottom: 2,
                  left: 2,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDE9959),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFF28274A), width: 1.5),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.edit_rounded,
                        color: Colors.white,
                        size: 12,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 16),

          // 2. Left: User Name and Caravan Subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFFB5B3C8),
                    fontSize: 12,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Group 1: کارنامه و دستاوردها, گواهی ها (برای دانش‌آموز), تیکت های شما
  Widget _buildGroupOneList(UserModel user, {bool isMentor = false}) {
    return Column(
      children: [
        _buildProfileMenuItem(
          title: 'کارنامه و دستاوردها',
          svgAsset: 'assets/svg_icons/reazelt01.svg',
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => _ReportCardAndAchievementsScreen(
                  user: user,
                  stations: _lmsStations,
                  progressList: _userProgressList,
                ),
              ),
            );
          },
        ),
        if (!isMentor)
          _buildProfileMenuItem(
            title: 'گواهی ها',
            svgAsset: 'assets/svg_icons/digree .svg',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => CertificatesScreen(user: user),
                ),
              );
            },
          ),
        _buildProfileMenuItem(
          title: 'تیکت های شما',
          svgAsset: 'assets/svg_icons/ticket01.svg',
          onTap: () => Navigator.pushNamed(context, '/tickets'),
        ),
      ],
    );
  }

  /// Group 2: داستان, پشتیبانی و ارتباط با ما, خروج از حساب کاربری
  Widget _buildGroupTwoList(UserModel user) {
    return Column(
      children: [
        _buildProfileMenuItem(
          title: 'داستان',
          svgAsset: 'assets/svg_icons/stor01.svg',
          fallbackIcon: Icons.info_outline_rounded,
          onTap: () => _StoryDialog.show(context),
        ),
        _buildProfileMenuItem(
          title: 'پشتیبانی و ارتباط با ما',
          svgAsset: 'assets/svg_icons/Support01.svg',
          onTap: () => ContactUsDialog.show(context, user: user),
        ),
        _buildProfileMenuItem(
          title: 'خروج از حساب کاربری',
          svgAsset: 'assets/svg_icons/exit01.svg',
          onTap: () => LogoutDialog.show(context),
        ),
      ],
    );
  }

  /// Generic Row Menu Item matching reference design with tighter padding & refined font size
  Widget _buildProfileMenuItem({
    required String title,
    required String svgAsset,
    IconData? fallbackIcon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7.5, horizontal: 6),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              children: [
                // Right in RTL: SVG Icon Container
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  child: svgAsset.isNotEmpty
                      ? SvgPicture.asset(
                          svgAsset,
                          width: 22,
                          height: 22,
                          fit: BoxFit.contain,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFF9E9CD6),
                            BlendMode.srcIn,
                          ),
                          errorBuilder: (context, error, stackTrace) => Icon(
                            fallbackIcon ?? Icons.chevron_left_rounded,
                            color: const Color(0xFF9E9CD6),
                            size: 21,
                          ),
                        )
                      : Icon(
                          fallbackIcon ?? Icons.notifications_none_rounded,
                          color: const Color(0xFF9E9CD6),
                          size: 21,
                        ),
                ),
                const SizedBox(width: 14),

                // Left in RTL: Menu Label
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFFE2E0F2),
                      fontSize: 13.5,
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
      ),
    );
  }

  /// Subtle Horizontal Line Divider
  Widget _buildSubtleDivider() {
    return Container(
      height: 1,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.0),
            const Color(0xFF453F73).withValues(alpha: 0.6),
            Colors.white.withValues(alpha: 0.0),
          ],
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// NESTED SUB-SCREEN 1: کارنامه و دستاوردها (Report Card & Achievements)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// NESTED SUB-SCREEN 1: کارنامه و دستاوردها (Report Card & Achievements)
// -----------------------------------------------------------------------------
class _ReportCardAndAchievementsScreen extends StatefulWidget {
  final UserModel user;
  final List<Map<String, dynamic>> stations;
  final List<Map<String, dynamic>> progressList;

  const _ReportCardAndAchievementsScreen({
    required this.user,
    required this.stations,
    required this.progressList,
  });

  @override
  State<_ReportCardAndAchievementsScreen> createState() => _ReportCardAndAchievementsScreenState();
}

class _ReportCardAndAchievementsScreenState extends State<_ReportCardAndAchievementsScreen> {
  final Set<int> _expandedStationIndices = {0};

  List<Map<String, dynamic>> _getStationSessions(int stationIndex, Map<String, dynamic>? stationData) {
    if (stationData != null && stationData['categories'] != null) {
      final categories = stationData['categories'] as List? ?? [];
      final List<Map<String, dynamic>> sessions = [];
      for (final cat in categories) {
        if (cat is Map && cat['sessions'] is List) {
          sessions.addAll((cat['sessions'] as List).whereType<Map<String, dynamic>>());
        }
      }
      if (sessions.isNotEmpty) return sessions;
    }

    // Default structured mock sessions per station
    return [
      {
        'title': 'جلسه اول: شناخت مبانی و مهارت‌های فردی',
        'subtitle': 'ویدیو آموزشی و بررسی مفاهیم',
        'isCompleted': (stationIndex + 1) < widget.user.levelFrame,
      },
      {
        'title': 'جلسه دوم: تحلیل چالش‌ها و کار تیمی کاروان',
        'subtitle': 'تمرین عملی و سناریوهای حل مسئله',
        'isCompleted': (stationIndex + 1) < widget.user.levelFrame,
      },
      {
        'title': 'جلسه سوم: مهارت‌های رسانه‌ای و ارتباط موثر',
        'subtitle': 'کلاس تخصصی و دستاوردهای رسانه‌ای',
        'isCompleted': (stationIndex + 1) < widget.user.levelFrame,
      },
      {
        'title': 'جلسه چهارم: آزمون پایانی و ارزیابی منزلگاه',
        'subtitle': 'آزمون جامع و دریافت پاداش زریک',
        'isCompleted': (stationIndex + 1) < widget.user.levelFrame,
      },
    ];
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final stations = widget.stations;
    final progressList = widget.progressList;

    int watchedClipsCount = progressList.where((p) => p['isWatched'] == true).length;
    int passedQuizzesCount = progressList.where((p) => p['quizPassed'] == true).length;
    int certificatesCount = user.levelFrame > 1 ? (user.levelFrame - 1) : 0;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 4,
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Station Progress Stepper (استپر بالای منزلگاه)
              StationProgressStepper(
                currentStationIndex: (user.levelFrame - 1).clamp(0, 5),
                userLevelFrame: user.levelFrame,
                completedStationsCount: user.completedStationsCount,
                title: 'منزلگاه‌های آموزشی مسافر',
              ),

              const SizedBox(height: 18),

              // 2. Overall Progress Card (باکس وضعیت کلی با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'وضعیت کلی مسافر در کاروان',
                      style: TextStyle(
                        color: Color(0xFFFFD580),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildStatBox('منزلگاه کنونی', user.levelFrame.toPersian()),
                        _buildStatBox('ویدیوها', watchedClipsCount.toPersian()),
                        _buildStatBox('آزمون‌ها', passedQuizzesCount.toPersian()),
                        _buildStatBox('گواهی‌نامه‌ها', certificatesCount.toPersian()),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 3. Wealth & Assets Card (باکس دارایی‌ها با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'دارایی‌ها و پاداش‌ها',
                      style: TextStyle(
                        color: Color(0xFFFFD580),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildAssetBox('زریک', user.zarik.toPersian(), const Color(0xFFE5A66B)),
                        _buildAssetBox('درفش', user.beyragh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox('نخ', user.nakh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox('فرش', user.farsh.toPersian(), const Color(0xFF9292E2)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 4. Station Road Map & Sessions Stepper (پیشرفت در منزلگاه‌ها با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'پیشرفت در منزلگاه‌ها',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    for (int i = 0; i < (stations.isNotEmpty ? stations.length : 6); i++) ...[
                      _buildStationAccordionItem(
                        index: i,
                        stationData: i < stations.length ? stations[i] : null,
                        userLevelFrame: user.levelFrame,
                      ),
                      if (i < (stations.isNotEmpty ? stations.length : 6) - 1)
                        const SizedBox(height: 10),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  /// Station Accordion Item with nested Stepper of sessions
  Widget _buildStationAccordionItem({
    required int index,
    required Map<String, dynamic>? stationData,
    required int userLevelFrame,
  }) {
    final bool isCompletedStation = (index + 1) < userLevelFrame;
    final bool isCurrentStation = (index + 1) == userLevelFrame;
    final bool isLocked = (index + 1) > userLevelFrame;
    final bool isExpanded = _expandedStationIndices.contains(index);

    final String stationTitle = stationData != null && stationData['title'] != null
        ? stationData['title'].toString()
        : 'منزلگاه ${index + 1}';

    final sessions = _getStationSessions(index, stationData);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isCurrentStation
              ? const Color(0xFFDE9959).withValues(alpha: 0.6)
              : const Color(0xFF453F73).withValues(alpha: 0.5),
          width: 1.1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: Column(
          children: [
            // Station Header Row (Tap to expand/collapse)
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedStationIndices.remove(index);
                  } else {
                    _expandedStationIndices.add(index);
                  }
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    // Status Badge Icon
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isCompletedStation
                            ? const Color(0xFF10B981)
                            : (isCurrentStation ? const Color(0xFFDE9959) : const Color(0xFF383562)),
                      ),
                      child: Center(
                        child: Icon(
                          isCompletedStation
                              ? Icons.check_rounded
                              : (isCurrentStation ? Icons.play_arrow_rounded : Icons.lock_outline_rounded),
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Station Title
                    Expanded(
                      child: Text(
                        'منزلگاه ${(index + 1).toPersian()}: $stationTitle',
                        style: TextStyle(
                          color: isLocked ? Colors.white54 : Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    // Chevron Arrow
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: const Color(0xFF9E9CD6),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),

            // Expanded Sessions Stepper List
            if (isExpanded) ...[
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF161528),
                  border: Border(top: BorderSide(color: Color(0xFF282542), width: 1.0)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  children: List.generate(sessions.length, (sIdx) {
                    final session = sessions[sIdx];
                    final bool isSessionCompleted = isCompletedStation || (isCurrentStation && sIdx == 0);
                    final isLastSession = sIdx == sessions.length - 1;

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Stepper Node & Line on Right in RTL
                        Column(
                          children: [
                            Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSessionCompleted
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF352F5A),
                                border: Border.all(
                                  color: isSessionCompleted
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFF8B88E8).withValues(alpha: 0.6),
                                  width: 1.2,
                                ),
                              ),
                              child: Center(
                                child: Icon(
                                  isSessionCompleted ? Icons.check_rounded : Icons.play_arrow_rounded,
                                  color: isSessionCompleted ? Colors.white : const Color(0xFFFFD580),
                                  size: 13,
                                ),
                              ),
                            ),
                            if (!isLastSession)
                              Container(
                                width: 2,
                                height: 32,
                                color: isSessionCompleted
                                    ? const Color(0xFF10B981).withValues(alpha: 0.5)
                                    : const Color(0xFF383562),
                              ),
                          ],
                        ),

                        const SizedBox(width: 12),

                        // Session Title and Subtitle
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  session['title']?.toString() ?? 'جلسه ${(sIdx + 1).toPersian()}',
                                  style: TextStyle(
                                    color: isSessionCompleted ? Colors.white : const Color(0xFFDDD9EE),
                                    fontSize: 12,
                                    fontWeight: isSessionCompleted ? FontWeight.bold : FontWeight.w500,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  isSessionCompleted
                                      ? 'مشاهده‌شده و تایید شده ✓'
                                      : (isLocked ? 'قفل شده' : 'آماده مشاهده و گذراندن'),
                                  style: TextStyle(
                                    color: isSessionCompleted ? const Color(0xFF10B981) : const Color(0xFF8E8B9E),
                                    fontSize: 10.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Exchange Box Decoration (باکس قالب مبادله)
  static Widget _buildExchangeCard({required Widget child}) {
    return Container(
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
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20.8),
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
        child: child,
      ),
    );
  }

  static Widget _buildStatBox(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFFB5B3C8), fontSize: 11, fontFamily: AppTheme.fontFamily)),
      ],
    );
  }

  static Widget _buildAssetBox(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: AppTheme.fontFamily)),
        ],
      ),
    );
  }
}



// -----------------------------------------------------------------------------
// DIALOG: داستان کاروان (Caravan Lore / Story)
// -----------------------------------------------------------------------------
class _StoryDialog {
  static void show(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: const Color(0xFF28274A),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
              side: const BorderSide(color: Color(0xFF5A588B), width: 1.2),
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(
                      child: Text(
                        'داستان سفر کاروان نپا 🌟',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'نپا سفری شگفت‌انگیز در دل منزلگاه‌های یادگیری و رشد فردی و گروهی است.\n\n'
                      'در این مسیر، مسافران با همراهی راهبر کاروان از منزلگاه‌های آموزشی عبور کرده، چالش‌های مختلف را حل می‌کنند، مهارت‌های کاربردی کسب می‌نمایند و با دریافت زریک و سرمایه‌های کاروان به اوج تعالی و موفقیت می‌رسند.\n\n'
                      'با همت و تلاش مستمر، گام به گام تا منزلگاه نهایی پیش خواهیم رفت!',
                      textAlign: TextAlign.justify,
                      style: TextStyle(
                        color: Color(0xFFD6D3E6),
                        fontSize: 12.5,
                        height: 1.6,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Center(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDE9959),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('متوجه شدم', style: TextStyle(fontFamily: AppTheme.fontFamily, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}


typedef ProfileScreen = StudentProfileScreen;
