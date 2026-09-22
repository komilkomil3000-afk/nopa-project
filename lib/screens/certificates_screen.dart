import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
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

  String _getPersianDate() {
    final now = Jalali.now();
    final y = now.year;
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y/$m/$d';
  }

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

  /// Show Option Dialog when clicking a completed course: Virtual vs Physical Certificate
  void _showCertificateOptionsDialog(Map<String, dynamic> course) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: AppColors.screenBackgroundGradient,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: const Color(0xFF5A4D80),
                width: 1.1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header with Certificate SVG Icon & Title
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF2C2849),
                        border: Border.all(
                          color: const Color(0xFFC09268),
                          width: 1.2,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: SvgPicture.asset(
                        'assets/svg_icons/digree .svg',
                        width: 24,
                        height: 24,
                        colorFilter: const ColorFilter.mode(
                          Color(0xFFE1BC96),
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'انتخاب نوع دریافت گواهی',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            course['title'] as String,
                            style: const TextStyle(
                              color: Color(0xFFC7B299),
                              fontSize: 12,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 22),

                // Option 1: درخواست نسخه مجازی (Digital / Download)
                InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    _handleVirtualCertificate(course);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(
                          color: const Color(0xFFC09268),
                          width: 1.1,
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.cloud_download_outlined, color: Color(0xFFE1BC96), size: 22),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'درخواست نسخه مجازی (رایگان)',
                                  style: TextStyle(
                                    color: Color(0xFFE1BC96),
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'صدور آنی و دانلود فایل دیجیتال معتبر گواهی',
                                  style: TextStyle(
                                    color: Color(0xFFB5B0D8),
                                    fontSize: 11.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFFE1BC96), size: 14),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Option 2: درخواست نسخه فیزیکی (Physical Printed)
                InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    _openPhysicalRequestDialog(course);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(
                          color: const Color(0xFF7A6B9E),
                          width: 1.1,
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.local_shipping_outlined, color: Color(0xFFDCD8F0), size: 22),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'درخواست نسخه فیزیکی و چاپی',
                                  style: TextStyle(
                                    color: Color(0xFFE2E0F2),
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'چاپ نفیس با هولوگرام رسمی و ارسال پستی درب منزل',
                                  style: TextStyle(
                                    color: Color(0xFFB5B0D8),
                                    fontSize: 11.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFFB5B0D8), size: 14),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Cancel Button
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text(
                      'انصراف',
                      style: TextStyle(
                        color: Color(0xFF9E9CD6),
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
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

  /// Physical Certificate Order Dialog: Address + Cost + Online Payment + Final Submission
  void _openPhysicalRequestDialog(Map<String, dynamic> course) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => _PhysicalCertificateOrderDialog(
        course: course,
        user: widget.user,
        currentDate: _getPersianDate(),
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
          onTap: () => _showCertificateOptionsDialog(item),
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
    required VoidCallback onTap,
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
      child: Material(
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
                      Text(
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

                      // Action Buttons for completed courses: Side by side in a Row
                      if (isCompleted)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              // 1. دانلود گواهی Button (Matching ثبت تغییرات style)
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => _handleVirtualCertificate(course),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5.5),
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
                                        Icon(Icons.download_rounded, color: Color(0xFFE1BC96), size: 13),
                                        SizedBox(width: 3),
                                        Flexible(
                                          child: Text(
                                            'دانلود گواهی',
                                            style: TextStyle(
                                              color: Color(0xFFE1BC96),
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: AppTheme.fontFamily,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),

                              // 2. درخواست گواهی فیزیکی Button (Matching ثبت تغییرات style)
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => _openPhysicalRequestDialog(course),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5.5),
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
                                        Icon(Icons.local_shipping_outlined, color: Color(0xFFE1BC96), size: 13),
                                        SizedBox(width: 3),
                                        Flexible(
                                          child: Text(
                                            'درخواست گواهی فیزیکی',
                                            style: TextStyle(
                                              color: Color(0xFFE1BC96),
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: AppTheme.fontFamily,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
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
    );
  }
}

/// Physical Certificate Order Modal Dialog (Address + Cost + Online Payment + Final Submit)
class _PhysicalCertificateOrderDialog extends StatefulWidget {
  final Map<String, dynamic> course;
  final UserModel user;
  final String currentDate;

  const _PhysicalCertificateOrderDialog({
    required this.course,
    required this.user,
    required this.currentDate,
  });

  @override
  State<_PhysicalCertificateOrderDialog> createState() => _PhysicalCertificateOrderDialogState();
}

class _PhysicalCertificateOrderDialogState extends State<_PhysicalCertificateOrderDialog> {
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _addressCtrl;
  late TextEditingController _postalCodeCtrl;

  bool _isProcessingPayment = false;
  final String _costFormatted = '۵۰,۰۰۰ تومان';

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.user.name);
    _phoneCtrl = TextEditingController(text: widget.user.phoneNumber);
    _addressCtrl = TextEditingController(text: widget.user.city ?? 'تهران، میدان آزادی...');
    _postalCodeCtrl = TextEditingController(text: '1234567890');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _postalCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitPhysicalOrder() async {
    final address = _addressCtrl.text.trim();
    if (address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً آدرس دقیق تحویل را وارد کنید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isProcessingPayment = true);

    try {
      final api = HttpApiService();
      // Create support ticket for physical certificate issuance and shipping
      await api.createTicket(
        category: 'درخواست گواهی فیزیکی',
        subject: 'درخواست نسخه چاپی ${widget.course['title']} - تحویل گیرنده: ${_nameCtrl.text.trim()} - آدرس: $address - کدپستی: ${_postalCodeCtrl.text.trim()}',
      );

      if (!mounted) return;
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'پرداخت آنلاین موفق! درخواست نسخه فیزیکی گواهی با موفقیت برای پشتیبانی ثبت شد و به زودی ارسال می‌شود ✅',
            style: TextStyle(fontFamily: AppTheme.fontFamily),
          ),
          backgroundColor: Color(0xFF10B981),
          duration: Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      setState(() => _isProcessingPayment = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('خطا در ثبت درخواست: $e', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 440),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
          decoration: BoxDecoration(
            color: const Color(0xFF2C2849),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 24,
                spreadRadius: 2,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header: Icon on right (in RTL) and Centered Title
                const Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: Icon(
                        Icons.card_membership_rounded,
                        color: Color(0xFF9E9CD6),
                        size: 32,
                      ),
                    ),
                    Text(
                      'درخواست نسخه فیزیکی گواهی',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Field 1: موضوع
                _buildInfoRow(label: 'موضوع:', text: 'صدور و ارسال نسخه فیزیکی'),
                const SizedBox(height: 10),

                // Field 2: دوره
                _buildInfoRow(label: 'دوره:', text: widget.course['title'] as String),
                const SizedBox(height: 10),

                // Field 3: تاریخ
                _buildInfoRow(label: 'تاریخ:', text: widget.currentDate),
                const SizedBox(height: 10),

                // Field 4: تحویل‌گیرنده
                _buildInputField(
                  label: 'تحویل‌گیرنده:',
                  controller: _nameCtrl,
                  hintText: 'نام و نام خانوادگی',
                ),
                const SizedBox(height: 10),

                // Field 5: شماره تماس
                _buildInputField(
                  label: 'تلفن همراه:',
                  controller: _phoneCtrl,
                  hintText: '09380346668',
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 10),

                // Field 6: آدرس پستی
                _buildInputField(
                  label: 'آدرس:',
                  controller: _addressCtrl,
                  hintText: 'استان، شهر، خیابان، پلاک...',
                  maxLines: 2,
                ),
                const SizedBox(height: 10),

                // Field 7: کد پستی
                _buildInputField(
                  label: 'کد پستی:',
                  controller: _postalCodeCtrl,
                  hintText: 'کد پستی ۱۰ رقمی',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 10),

                // Field 8: هزینه ارسال
                _buildInfoRow(label: 'هزینه ارسال:', text: _costFormatted),

                const SizedBox(height: 22),

                // Bottom Buttons: پرداخت و ثبت نهایی (Right) & انصراف (Left)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // پرداخت و ثبت نهایی (Right in RTL)
                    TextButton(
                      onPressed: _isProcessingPayment ? null : _submitPhysicalOrder,
                      child: _isProcessingPayment
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFE1BC96)),
                            )
                          : const Text(
                              'پرداخت و ثبت نهایی',
                              style: TextStyle(
                                color: Color(0xFFE1BC96),
                                fontSize: 14.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                    ),

                    // انصراف (Left in RTL)
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text(
                        'انصراف',
                        style: TextStyle(
                          color: Color(0xFF9E9CD6),
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Info Row matching Contact Us Dialog structure
  Widget _buildInfoRow({required String label, required String text}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // 1. Label Pill on RIGHT (First child in RTL)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: const Color(0xFF7A709E),
              width: 1.1,
            ),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFDDD9EE),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(width: 10),

        // 2. Value on LEFT (Second child in RTL)
        Expanded(
          child: Text(
            text,
            textAlign: TextAlign.left,
            style: const TextStyle(
              color: Color(0xFFE1BC96),
              fontSize: 13,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  /// Input Field matching Contact Us Dialog structure
  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required String hintText,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return Row(
      crossAxisAlignment: maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      children: [
        // 1. Label Pill on RIGHT (First child in RTL)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: const Color(0xFF7A709E),
              width: 1.1,
            ),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFDDD9EE),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(width: 10),

        // 2. Text Input on LEFT (Second child in RTL)
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF221E3A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFF7A709E).withValues(alpha: 0.6),
                width: 1.0,
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            child: TextField(
              controller: controller,
              keyboardType: keyboardType,
              maxLines: maxLines,
              style: const TextStyle(
                color: Color(0xFFE1BC96),
                fontSize: 12.5,
                fontFamily: AppTheme.fontFamily,
              ),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: hintText,
                hintStyle: TextStyle(
                  color: Colors.white.withValues(alpha: 0.25),
                  fontSize: 11.5,
                  fontFamily: AppTheme.fontFamily,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 5),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
