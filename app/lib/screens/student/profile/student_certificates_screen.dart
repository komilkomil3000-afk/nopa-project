import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/screens/student/profile/student_certificate_detail_screen.dart';

class StudentCertificatesScreen extends StatefulWidget {
  final UserModel user;

  const StudentCertificatesScreen({super.key, required this.user});

  @override
  State<StudentCertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<StudentCertificatesScreen> {
  // 0: دوره‌های جاری (Active / In-progress)
  // 1: دوره‌های گذرانده شده (Completed / Certificates earned)
  int _selectedTabIndex = 1; // Default to completed certificates so they see certificates right away

  String get _caravanName {
    final name = widget.user.caravanName?.trim() ?? '';
    return name.isNotEmpty ? name : 'فاقد کاروان';
  }

  /// Shamsi date (Persian digits) of an ISO timestamp, e.g. Certificate.issuedAt; empty when it cannot be read.
  static String _shamsiDate(dynamic iso) {
    final dt = DateTime.tryParse(iso?.toString() ?? '');
    if (dt == null) return '';
    final j = Jalali.fromDateTime(dt.toLocal());
    String two(int n) => n.toString().padLeft(2, '0');
    return '${j.year}/${two(j.month)}/${two(j.day)}'.toPersianDigits();
  }

  /// Earned certificates: the user's Certificate rows (id, title, verifyId, issuedAt) sent by GET /users/me.
  List<Map<String, dynamic>> _getCompletedCourses() {
    final user = widget.user;
    final teacher = (user.caravanMentor?.trim().isNotEmpty ?? false) ? user.caravanMentor!.trim() : 'راهبر کاروان';
    return [
      for (final c in (user.certificates ?? const []).whereType<Map>())
        {
          'id': c['id']?.toString() ?? '',
          'verifyId': c['verifyId']?.toString() ?? '',
          'title': c['title']?.toString() ?? 'گواهی‌نامه نپا',
          'description': '',
          'teacher': teacher,
          'sessionsCount': '',
          'date': _shamsiDate(c['issuedAt']),
          'isCompleted': true,
          'caravan': _caravanName,
          'imageUrl': '',
        },
    ];
  }

  /// Courses in progress: the server sends no per-course progress for certificates yet, so this list
  /// stays empty (the tab shows its empty state) instead of invented courses.
  List<Map<String, dynamic>> _getOngoingCourses() => const [];



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

    AppToast.success(context, 'گواهی مجازی «${course['title']}» با موفقیت صادر و آماده مشاهده شد');
  }

  @override
  Widget build(BuildContext context) {
    final completedCourses = _getCompletedCourses();
    final ongoingCourses = _getOngoingCourses();

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: AppTabs.profile,
      onBackTap: () => Navigator.of(context).pop(),
      body: Column(
        children: [
          // 1. Filter Tabs: دوره‌های جاری / دوره‌های گذرانده شده
          _buildFilterTabsBar(),

          const SizedBox(height: 10),

          // 2. Main List of Courses (Matching MapScreen Station Card style)
          Expanded(
            child: _selectedTabIndex == 1
                ? _buildCompletedCoursesList(completedCourses)
                : _buildOngoingCoursesList(ongoingCourses),
          ),
        ],
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
                  child: TapExpander(child: GestureDetector(
                    onTap: () => setState(() => _selectedTabIndex = idx),
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        tab['title'] as String,
                        style: TextStyle(
                          color: isSelected ? AppColors.accentGoldEnd : const Color(0xFF9D99B8),
                          fontSize: isSelected ? 15.5 : 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          fontFamily: AppTheme.fontFamily,
                          shadows: isSelected
                              ? [
                                  Shadow(
                                    color: AppColors.buttonCamel.withValues(alpha: 0.45),
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                    ),
                  )),
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
            AppToast.info(context, 'این دوره در حال برگزاری است. پیشرفت شما: ${item['progressText']}');
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
            child: TapExpander(child: InkWell(
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
                              AppColors.buttonCancelPurple,
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
                              style: AppTypography.h3,
                            ),
                          ),
                          const SizedBox(height: 4),

                          // Topic
                          Text(
                            'موضوع: $desc',
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.captionMuted,
                          ),
                          const SizedBox(height: 3),

                          // Sessions Count & Instructor
                          Text(
                            sessionsCount.isNotEmpty ? 'تعداد جلسات: $sessionsCount • راهبر: $teacher' : 'راهبر: $teacher',
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(color: Color(0xFFC7B299)),
                          ),

                          const SizedBox(height: 8),

                          // Action Button for completed courses: «دریافت» (Matching ثبت تغییرات style)
                          if (isCompleted)
                            Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: TapExpander(child: GestureDetector(
                                onTap: () => _handleVirtualCertificate(course),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2A2835),
                                    borderRadius: BorderRadius.circular(7),
                                    border: Border.all(
                                      color: AppColors.buttonCamel,
                                      width: 1.0,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.card_membership_rounded, color: AppColors.accentGoldEnd, size: 14),
                                      SizedBox(width: 5),
                                      Text(
                                        'دریافت',
                                        style: AppTypography.caption.copyWith(color: AppColors.accentGoldEnd),
                                      ),
                                    ],
                                  ),
                                ),
                              )),
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
                                  style: AppTypography.caption.copyWith(color: AppColors.buttonCancelPurple),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )),
          ),

          // Dedicated Direct Download Icon Button in Top-Left corner of certificate card
          if (isCompleted)
            Positioned(
              left: 10,
              top: 10,
              child: Material(
                color: Colors.transparent,
                child: TapExpander(child: InkWell(
                  onTap: () => _handleVirtualCertificate(course),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFF242240),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.buttonCamel.withValues(alpha: 0.6),
                        width: 1.0,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.file_download_outlined,
                      color: AppColors.accentGoldEnd,
                      size: 16,
                    ),
                  ),
                )),
              ),
            ),
        ],
      ),
    );
  }
}



typedef CertificatesScreen = StudentCertificatesScreen;
