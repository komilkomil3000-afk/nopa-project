import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';
import 'certificate_view_screen.dart';

class CertificatesScreen extends StatefulWidget {
  final UserModel user;

  const CertificatesScreen({super.key, required this.user});

  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  // 0: دوره‌های جاری (Active / In-progress)
  // 1: دوره‌های گذرانده شده (Completed / Certificates earned)
  int _selectedTabIndex = 1; // Default to completed certificates so they see certificates right away

  List<Map<String, dynamic>> _getCompletedCourses() {
    final user = widget.user;
    final caravan = (user.caravanName != null && user.caravanName!.isNotEmpty)
        ? user.caravanName!
        : 'کاروان شماره ۵';

    return [
      {
        'id': 'cert_station_0',
        'title': 'گواهی گذر از منزلگاه صفر (راهنمای کاروان)',
        'description': 'آموزش‌های پایه و آشنایی با ساختار و اهداف کاروان نپا',
        'teacher': 'راهنمای کاروان',
        'sessionsCount': '۴ جلسه',
        'date': '۱۴۰۳/۰۶/۱۵',
        'isCompleted': true,
        'caravan': caravan,
        'imageUrl': '',
      },
      {
        'id': 'cert_station_1',
        'title': 'گواهی گذر از منزلگاه اول (کاروانسرای غبارگرفته)',
        'description': 'شناخت مهارت‌های ارتباطی و فعالیت‌های جمعی در مسیر سفر',
        'teacher': 'استاد محمد حسینی',
        'sessionsCount': '۶ جلسه',
        'date': '۱۴۰۳/۰۷/۰۱',
        'isCompleted': true,
        'caravan': caravan,
        'imageUrl': '',
      },
      {
        'id': 'cert_station_2',
        'title': 'گواهی دوره جامع مهارت‌های رسانه‌ای و سواد دیجیتال',
        'description': 'تولید محتوا، روایت‌گری و فعالیت مؤثر رسانه‌ای در فضای مجازی',
        'teacher': 'دکتر علیرضا رضایی',
        'sessionsCount': '۸ جلسه',
        'date': '۱۴۰۳/۰۸/۱۰',
        'isCompleted': true,
        'caravan': caravan,
        'imageUrl': '',
      },
    ];
  }

  List<Map<String, dynamic>> _getOngoingCourses() {
    final user = widget.user;
    final caravan = (user.caravanName != null && user.caravanName!.isNotEmpty)
        ? user.caravanName!
        : 'کاروان شماره ۵';

    return [
      {
        'id': 'course_station_3',
        'title': 'دوره آموزشی منزلگاه سوم (گذرگاه امید و استقامت)',
        'description': 'توسعه مهارت‌های حل مسئله و کارگروهی در چالش‌های سخت',
        'teacher': 'استاد علی اکبری',
        'sessionsCount': '۶ جلسه',
        'progress': 0.65,
        'progressText': '۴ از ۶ جلسه مشاهده شده',
        'isCompleted': false,
        'caravan': caravan,
        'imageUrl': '',
      },
      {
        'id': 'course_station_4',
        'title': 'دوره تخصصی مدیریت منابع و سرمایه‌های کاروان',
        'description': 'آشنایی با مدیریت دارایی‌های زریک، درفش و صرافی بازار',
        'teacher': 'مهندس کاظمی',
        'sessionsCount': '۵ جلسه',
        'progress': 0.20,
        'progressText': '۱ از ۵ جلسه مشاهده شده',
        'isCompleted': false,
        'caravan': caravan,
        'imageUrl': '',
      },
    ];
  }



  /// Virtual Certificate Handler: Opens Certificate View & Downloads
  void _handleVirtualCertificate(Map<String, dynamic> course) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CertificateViewScreen(
          certificate: course,
          userName: widget.user.name,
        ),
      ),
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'گواهی مجازی «${course['title']}» با موفقیت صادر و آماده مشاهده شد ✅',
          style: const TextStyle(fontFamily: AppTheme.fontFamily),
        ),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final completedCourses = _getCompletedCourses();
    final ongoingCourses = _getOngoingCourses();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
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
                // 1. Top Bar matching ProfileScreen exactly
                _buildTopBar(),

                // 2. Filter Tabs: دوره‌های جاری / دوره‌های گذرانده شده
                _buildFilterTabsBar(),

                const SizedBox(height: 10),

                // 3. Main List of Courses (Matching MapScreen Station Card style)
                Expanded(
                  child: _selectedTabIndex == 1
                      ? _buildCompletedCoursesList(completedCourses)
                      : _buildOngoingCoursesList(ongoingCourses),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Top Bar matching ProfileScreen
  Widget _buildTopBar() {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
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
                  onTap: () => Navigator.of(context).pop(),
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
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.of(context).pop(),
                    borderRadius: BorderRadius.circular(22),
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: const BoxDecoration(
                        color: Color(0xFF23223D),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: SvgPicture.asset(
                          'assets/svg_icons/Manual01.svg',
                          width: 22,
                          height: 22,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFFC7B299),
                            BlendMode.srcIn,
                          ),
                          errorBuilder: (context, error, stackTrace) => const Icon(
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

  /// Filter Tabs Bar: «دوره‌های جاری» و «دوره‌های گذرانده شده» (Matching Challenges style)
  Widget _buildFilterTabsBar() {
    final tabs = [
      {'title': 'دوره‌های گذرانده شده', 'index': 1},
      {'title': 'دوره‌های جاری', 'index': 0},
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: tabs.map((tab) {
              final int idx = tab['index'] as int;
              final bool isSelected = _selectedTabIndex == idx;

              return Expanded(
                child: Center(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedTabIndex = idx),
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        tab['title'] as String,
                        style: TextStyle(
                          color: isSelected ? const Color(0xFFE1BC96) : const Color(0xFF9D99B8),
                          fontSize: isSelected ? 15.5 : 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          fontFamily: AppTheme.fontFamily,
                          shadows: isSelected
                              ? [
                                  Shadow(
                                    color: const Color(0xFFC09268).withValues(alpha: 0.45),
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 6),
          // Subtle Divider Line
          Container(
            height: 1.0,
            width: double.infinity,
            margin: const EdgeInsets.symmetric(horizontal: 20),
            color: const Color(0xFF383556).withValues(alpha: 0.7),
          ),
        ],
      ),
    );
  }

  /// List of Completed Courses (Earned Certificates) matching MapScreen Station Card style
  Widget _buildCompletedCoursesList(List<Map<String, dynamic>> courses) {
    if (courses.isEmpty) {
      return const Center(
        child: Text(
          'هنوز دوره‌ای به پایان نرسیده است.',
          style: TextStyle(color: Color(0xFF9D99B8), fontFamily: AppTheme.fontFamily),
        ),
      );
    }

    return ListView.separated(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      itemCount: courses.length,
      separatorBuilder: (context, index) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = courses[index];
        return _buildCourseStationCard(
          course: item,
          isCompleted: true,
        );
      },
    );
  }

  /// List of Ongoing Courses matching MapScreen Station Card style
  Widget _buildOngoingCoursesList(List<Map<String, dynamic>> courses) {
    if (courses.isEmpty) {
      return const Center(
        child: Text(
          'دوره جاری فعالی وجود ندارد.',
          style: TextStyle(color: Color(0xFF9D99B8), fontFamily: AppTheme.fontFamily),
        ),
      );
    }

    return ListView.separated(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      itemCount: courses.length,
      separatorBuilder: (context, index) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = courses[index];
        return _buildCourseStationCard(
          course: item,
          isCompleted: false,
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'این دوره در حال برگزاری است. پیشرفت شما: ${item['progressText']}',
                  style: const TextStyle(fontFamily: AppTheme.fontFamily),
                ),
                backgroundColor: const Color(0xFF2C2849),
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
        );
      },
    );
  }

  /// Station-style Card matching MapScreen `_buildMapStationCard`
  Widget _buildCourseStationCard({
    required Map<String, dynamic> course,
    required bool isCompleted,
    VoidCallback? onTap,
  }) {
    final title = course['title'] as String;
    final teacher = course['teacher'] as String;
    final desc = course['description'] as String;
    final sessionsCount = course['sessionsCount'] as String;
    final double progress = (course['progress'] as num?)?.toDouble() ?? 1.0;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF453F73),
          width: 1.2,
        ),
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
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // 1. Right in RTL: Rectangular Image box (A4 ratio 56x79) with Certificate SVG
                    Container(
                      width: 56,
                      height: 79,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: const Color(0xFF9292E2),
                          width: 1.5,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8.5),
                        child: Container(
                          color: const Color(0xFF2E2E50),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/svg_icons/digree .svg',
                            width: 32,
                            height: 32,
                            colorFilter: const ColorFilter.mode(
                              Color(0xFF9E9CD6),
                              BlendMode.srcIn,
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(width: 14),

                    // 2. Left in RTL: Title, Details, and Action Buttons / Progress
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Short Title
                          Padding(
                            padding: EdgeInsets.only(left: isCompleted ? 32 : 0),
                            child: Text(
                              title,
                              textAlign: TextAlign.right,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),

                          // Topic
                          Text(
                            'موضوع: $desc',
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFB5B3C8),
                              fontSize: 11,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 3),

                          // Sessions Count & Instructor
                          Text(
                            'تعداد جلسات: $sessionsCount • استاد: $teacher',
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFC7B299),
                              fontSize: 10.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),

                          const SizedBox(height: 8),

                          // Action Button for completed courses: «دریافت» (Matching ثبت تغییرات style)
                          if (isCompleted)
                            Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: GestureDetector(
                                onTap: () => _handleVirtualCertificate(course),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2A2835),
                                    borderRadius: BorderRadius.circular(7),
                                    border: Border.all(
                                      color: const Color(0xFFC09268),
                                      width: 1.0,
                                    ),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.card_membership_rounded, color: Color(0xFFE1BC96), size: 14),
                                      SizedBox(width: 5),
                                      Text(
                                        'دریافت',
                                        style: TextStyle(
                                          color: Color(0xFFE1BC96),
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: AppTheme.fontFamily,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )
                          else
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: progress,
                                    backgroundColor: const Color(0xFF28274A),
                                    valueColor: const CircularProgressIndicator.adaptive().valueColor ??
                                        const AlwaysStoppedAnimation<Color>(Color(0xFFDE9959)),
                                    minHeight: 5,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  course['progressText']?.toString() ?? 'در حال گذراندن',
                                  style: const TextStyle(
                                    color: Color(0xFF9E9CD6),
                                    fontSize: 10.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Dedicated Direct Download Icon Button in Top-Left corner of certificate card
          if (isCompleted)
            Positioned(
              left: 10,
              top: 10,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _handleVirtualCertificate(course),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFF242240),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFC09268).withValues(alpha: 0.6),
                        width: 1.0,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.file_download_outlined,
                      color: Color(0xFFE1BC96),
                      size: 16,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

