import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../main.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import '../utils/constants.dart';
import '../widgets/contact_us_dialog.dart';
import '../widgets/logout_dialog.dart';
import '../widgets/safe_avatar.dart';
import 'certificates_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
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

  void _handleBackAction() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      navigateToMainTab(0); // Return to Home
    }
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
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => Provider.of<AppRepository>(context, listen: false).refreshUser(),
          color: const Color(0xFFCD8449),
          backgroundColor: const Color(0xFF231C38),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Top Bar: NOPA Logo on Left, Bell + Drawer Menu on Right
                _buildTopBar(),

                const SizedBox(height: 18),

                // 2. User Info Card (Avatar with double ring & pencil badge on right, Name & Caravan on left)
                _buildUserHeaderCard(currentUser),

                const SizedBox(height: 16),

                // 3. Edit Profile Item (Clean Row without box background)
                _buildProfileMenuItem(
                  title: 'ویرایش اطلاعات',
                  svgAsset: 'assets/svg_icons/setting01.svg',
                  fallbackIcon: Icons.settings_rounded,
                  onTap: () => _openEditProfile(currentUser),
                ),

                // 4. Section: پیام ها (Messages / Notifications with Bell Icon)
                _buildProfileMenuItem(
                  title: 'پیام ها',
                  svgAsset: '',
                  fallbackIcon: Icons.notifications_none_rounded,
                  onTap: () => Navigator.pushNamed(context, '/notifications'),
                ),

                const SizedBox(height: 4),
                _buildSubtleDivider(),
                const SizedBox(height: 4),

                // 5. Group 1: کارنامه و دستاوردها, گواهی ها, تیکت های شما
                _buildGroupOneList(currentUser),

                const SizedBox(height: 4),
                _buildSubtleDivider(),
                const SizedBox(height: 4),

                // 6. Group 2: داستان, پشتیبانی و ارتباط با ما, خروج از حساب کاربری
                _buildGroupTwoList(currentUser),

                const SizedBox(height: 30),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Top Bar matching other main tabs
  Widget _buildTopBar() {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: NOPA Logo + Back SVG Icon
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: 42,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: ShaderMask(
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
                        fontSize: 21,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 2),
              GestureDetector(
                onTap: _handleBackAction,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.only(top: 2, bottom: 4, right: 8),
                  child: SvgPicture.asset(
                    'assets/svg_icons/back01.svg',
                    width: 20,
                    height: 20,
                    colorFilter: const ColorFilter.mode(
                      Color(0xFFC7B299),
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Right: Notification Bell Button + Drawer Hamburger Menu
          Row(
            mainAxisSize: MainAxisSize.min,
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
              const SizedBox(width: 10),
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
                          size: 24,
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
    );
  }

  /// User Info Card: Avatar with edit pencil badge on right, Name & Subtitle on left
  Widget _buildUserHeaderCard(UserModel user) {
    final String displayName = user.name.isNotEmpty ? user.name : 'کمیل عباس';
    final String caravanText = (user.caravanName != null && user.caravanName!.trim().isNotEmpty)
        ? 'عضو کاروان ${user.caravanName}'
        : 'عضو کاروان شماره پنجم';

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
                  caravanText,
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

  /// Group 1: کارنامه و دستاوردها, گواهی ها, تیکت های شما
  Widget _buildGroupOneList(UserModel user) {
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
class _ReportCardAndAchievementsScreen extends StatelessWidget {
  final UserModel user;
  final List<Map<String, dynamic>> stations;
  final List<Map<String, dynamic>> progressList;

  const _ReportCardAndAchievementsScreen({
    required this.user,
    required this.stations,
    required this.progressList,
  });

  @override
  Widget build(BuildContext context) {
    int watchedClipsCount = progressList.where((p) => p['isWatched'] == true).length;
    int passedQuizzesCount = progressList.where((p) => p['quizPassed'] == true).length;

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
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top bar with Back Button
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'کارنامه و دستاوردها',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // 1. Overall Progress Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF28274A),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF453F73), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'وضعیت کلی مسافر در کاروان',
                          style: TextStyle(color: Color(0xFFFFD580), fontSize: 14.5, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildStatBox('منزلگاه کنونی', user.levelFrame.toPersian()),
                            _buildStatBox('ویدیوهای دیده‌شده', watchedClipsCount.toPersian()),
                            _buildStatBox('آزمون‌های قبول‌شده', passedQuizzesCount.toPersian()),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // 2. Wealth & Assets Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF28274A),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF453F73), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'دارایی‌ها و پاداش‌ها',
                          style: TextStyle(color: Color(0xFFFFD580), fontSize: 14.5, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
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

                  const SizedBox(height: 20),

                  // 3. Station Road Map Summary
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF28274A),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF453F73), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'پیشرفت در منزلگاه‌ها',
                          style: TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
                        ),
                        const SizedBox(height: 12),
                        for (int i = 0; i < (stations.isNotEmpty ? stations.length : 6); i++)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: (i + 1) <= user.levelFrame ? const Color(0xFF10B981) : const Color(0xFF383562),
                                  ),
                                  child: Center(
                                    child: Icon(
                                      (i + 1) <= user.levelFrame ? Icons.check_rounded : Icons.lock_outline_rounded,
                                      color: Colors.white,
                                      size: 14,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'منزلگاه ${i.toPersian()}: ${i < stations.length ? (stations[i]['title'] ?? '') : 'آموزش کاروان'}',
                                    style: TextStyle(
                                      color: (i + 1) <= user.levelFrame ? Colors.white : Colors.white54,
                                      fontSize: 12.5,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static Widget _buildStatBox(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11, fontFamily: AppTheme.fontFamily)),
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
