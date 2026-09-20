import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';
import '../main.dart'; // For navigateToMainTab

enum ChallengeTabType { newChallenges, inProgress, expired }

class HomeChallengesSection extends StatefulWidget {
  const HomeChallengesSection({super.key});

  @override
  State<HomeChallengesSection> createState() => _HomeChallengesSectionState();
}

class _HomeChallengesSectionState extends State<HomeChallengesSection> {
  ChallengeTabType _selectedTab = ChallengeTabType.newChallenges;

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        final challenges = repository.challenges;
        final submissions = repository.submissions;

        return Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Header: "چالش‌های مخصوص تو" on the right, "همه" on the left
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'چالش‌های مخصوص تو',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        context.findAncestorStateOfType<MainScreenState>()?.setIndex(2);
                      },
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                        child: Text(
                          'همه',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // 2. Outer Card Container with exact Login Box Stroke & Gradient
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18.0),
                child: Container(
                  decoration: BoxDecoration(
                    gradient: AppColors.strokeGradient,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(AppColors.borderWidth),
                  child: Container(
                    padding: const EdgeInsets.all(16.0),
                    decoration: BoxDecoration(
                      gradient: AppColors.darkSurfaceGradient,
                      borderRadius: BorderRadius.circular(19),
                    ),
                    child: Column(
                      children: [
                        // 3 Tabs in Row (Right: جدید fir01 | Center: شروع شده fir02 | Left: منقضی شده fir03)
                        Row(
                          children: [
                            // Tab 1: جدید (fir01.svg - Green)
                            Expanded(
                              child: _buildTabPill(
                                type: ChallengeTabType.newChallenges,
                                title: 'جدید',
                                badgeColor: const Color(0xFF133C24),
                                iconPath: 'assets/svg_icons/fir01.svg',
                                selectedGradient: const LinearGradient(
                                  colors: [Color(0xFF2E8B57), Color(0xFF1E5E3A)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                unselectedColor: const Color(0xFF22362C),
                                borderColor: const Color(0xFF3EA369),
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Tab 2: شروع شده (fir02.svg - Amber/Orange)
                            Expanded(
                              child: _buildTabPill(
                                type: ChallengeTabType.inProgress,
                                title: 'شروع شده',
                                badgeColor: const Color(0xFF5E3200),
                                iconPath: 'assets/svg_icons/fir02.svg',
                                selectedGradient: const LinearGradient(
                                  colors: [Color(0xFFE59819), Color(0xFFC77700)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                unselectedColor: const Color(0xFF3A2D1A),
                                borderColor: const Color(0xFFE08D18),
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Tab 3: منقضی شده (fir03.svg - Slate/Purple)
                            Expanded(
                              child: _buildTabPill(
                                type: ChallengeTabType.expired,
                                title: 'منقضی شده',
                                badgeColor: const Color(0xFF3A3763),
                                iconPath: 'assets/svg_icons/fir03.svg',
                                selectedGradient: const LinearGradient(
                                  colors: [Color(0xFF4B487A), Color(0xFF343259)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                unselectedColor: const Color(0xFF272544),
                                borderColor: const Color(0xFF5A578E),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),

                        // 2 Latest Challenge Items List for the Active Tab
                        _buildItemsList(challenges, submissions, repository.currentUser),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Builds individual Tab Pill Button with fir01 / fir02 / fir03 icon on the RIGHT of the text (RTL)
  Widget _buildTabPill({
    required ChallengeTabType type,
    required String title,
    required Color badgeColor,
    required String iconPath,
    required LinearGradient selectedGradient,
    required Color unselectedColor,
    required Color borderColor,
  }) {
    final bool isSelected = _selectedTab == type;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedTab = type;
        });
      },
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: isSelected ? selectedGradient : null,
          color: isSelected ? null : unselectedColor,
          border: Border.all(
            color: isSelected ? borderColor : borderColor.withValues(alpha: 0.3),
            width: 1.2,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: borderColor.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 1. Right side in RTL: Circular Badge with SVG Flame Icon (fir01 / fir02 / fir03)
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: badgeColor,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: SvgPicture.asset(
                  iconPath,
                  width: 18,
                  height: 23,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(width: 6),

            // 2. Left side in RTL: Title text
            Flexible(
              child: Text(
                title,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the 2 latest items for the active tab (Strictly scoped to Caravan Mentor or Admin)
  Widget _buildItemsList(List<dynamic> allChallenges, List<dynamic> allSubmissions, UserModel? user) {
    final String myMentorName = (user?.caravanMentor != null && user!.caravanMentor!.isNotEmpty)
        ? user.caravanMentor!
        : 'رضا جلالی';

    // Strictly filter challenges: only challenges created by the user's own mentor or admin/system
    final authorizedChallenges = allChallenges.where((c) {
      if (c.isByAdmin == true) return true;
      if (c.caravanId != null && user?.caravanId != null && c.caravanId == user!.caravanId) return true;
      if (c.mentorName == myMentorName || c.creatorName == myMentorName) return true;
      if (c.creatorName == 'مدیر سیستم' || c.creatorName == 'مدیر') return true;
      return false;
    }).toList();

    final List<_ChallengeItemData> items = [];

    if (_selectedTab == ChallengeTabType.newChallenges) {
      final activeChallenges = authorizedChallenges.where((c) {
        final sub = allSubmissions.where((s) => s.challengeId == c.id).firstOrNull;
        final status = c.myStatus ?? sub?.status ?? 'none';
        return status == 'none' || status == 'active';
      }).toList();

      for (var c in activeChallenges.take(2)) {
        final creator = c.isByAdmin ? 'مدیر سیستم' : (c.creatorName ?? myMentorName);
        items.add(_ChallengeItemData(
          id: c.id,
          title: c.title,
          subtitle: 'ایجاد شده توسط $creator',
          actionText: 'بزن بریم',
        ));
      }

      // Fallback items strictly from the student's mentor or system admin
      if (items.isEmpty) {
        items.add(_ChallengeItemData(
          id: 'CH_SAMPLE_1',
          title: 'پوسترینو',
          subtitle: 'ایجاد شده توسط آقای $myMentorName',
          actionText: 'بزن بریم',
        ));
        items.add(_ChallengeItemData(
          id: 'CH_SAMPLE_2',
          title: 'تدوین خلاقانه',
          subtitle: 'ایجاد شده توسط آقای $myMentorName',
          actionText: 'مشاهده',
        ));
      } else if (items.length == 1) {
        items.add(_ChallengeItemData(
          id: 'CH_SAMPLE_2',
          title: 'تدوین خلاقانه',
          subtitle: 'ایجاد شده توسط آقای $myMentorName',
          actionText: 'مشاهده',
        ));
      }
    } else if (_selectedTab == ChallengeTabType.inProgress) {
      final inProgressChallenges = authorizedChallenges.where((c) {
        final sub = allSubmissions.where((s) => s.challengeId == c.id).firstOrNull;
        final status = c.myStatus ?? sub?.status ?? 'none';
        return status == 'pending' || status == 'PENDING_REVIEW' || status == 'in_progress' || status == 'archived_pending';
      }).toList();

      for (var c in inProgressChallenges.take(2)) {
        final creator = c.isByAdmin ? 'مدیر سیستم' : (c.creatorName ?? myMentorName);
        items.add(_ChallengeItemData(
          id: c.id,
          title: c.title,
          subtitle: 'ایجاد شده توسط $creator',
          actionText: 'ادامه چالش',
        ));
      }

      if (items.isEmpty) {
        items.add(_ChallengeItemData(
          id: 'CH_PROG_1',
          title: 'طراحی پوستر مفهومی',
          subtitle: 'ایجاد شده توسط آقای $myMentorName',
          actionText: 'ادامه چالش',
        ));
        items.add(const _ChallengeItemData(
          id: 'CH_PROG_2',
          title: 'ارزیابی خودشناسی',
          subtitle: 'ایجاد شده توسط مدیر سیستم',
          actionText: 'مشاهده وضعیت',
        ));
      }
    } else {
      // Expired / Completed Tab
      final expiredChallenges = authorizedChallenges.where((c) {
        final sub = allSubmissions.where((s) => s.challengeId == c.id).firstOrNull;
        final status = c.myStatus ?? sub?.status ?? 'none';
        return status == 'approved' || status == 'archived_completed' || status == 'rejected' || status == 'expired';
      }).toList();

      for (var c in expiredChallenges.take(2)) {
        final creator = c.isByAdmin ? 'مدیر سیستم' : (c.creatorName ?? myMentorName);
        items.add(_ChallengeItemData(
          id: c.id,
          title: c.title,
          subtitle: 'ایجاد شده توسط $creator',
          actionText: 'مشاهده نتیجه',
        ));
      }

      if (items.isEmpty) {
        items.add(_ChallengeItemData(
          id: 'CH_EXP_1',
          title: 'آزمونک اینشات',
          subtitle: 'ایجاد شده توسط آقای $myMentorName',
          actionText: 'مشاهده نتیجه',
        ));
        items.add(const _ChallengeItemData(
          id: 'CH_EXP_2',
          title: 'چالش عمومی نپا',
          subtitle: 'ایجاد شده توسط مدیر سیستم',
          actionText: 'پایان یافته',
        ));
      }
    }

    return Column(
      children: items.map((item) => _buildChallengeItemRow(item)).toList(),
    );
  }

  /// Builds an individual Challenge item row matching the login box gradient stroke and background
  Widget _buildChallengeItemRow(_ChallengeItemData item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      height: 52,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(13),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: InkWell(
          onTap: () {
            // Navigate to full challenges screen
            context.findAncestorStateOfType<MainScreenState>()?.setIndex(2);
          },
          borderRadius: BorderRadius.circular(13),
          child: Row(
            children: [
              // Right: Circular Avatar Badge with champun / trophy SVG
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: Color(0xFF332F5C),
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(5),
                child: Center(
                  child: SvgPicture.asset(
                    'assets/svg_icons/champun01.svg',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                item.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),

              // Middle: Subtitle (ایجاد شده توسط ...)
              Expanded(
                child: Text(
                  item.subtitle,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF9E9CB8),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w400,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ),

              // Left: Action Text (بزن بریم / مشاهده)
              Text(
                item.actionText,
                style: const TextStyle(
                  color: Color(0xFFE5A66B),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChallengeItemData {
  final String id;
  final String title;
  final String subtitle;
  final String actionText;

  const _ChallengeItemData({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.actionText,
  });
}
