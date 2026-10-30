import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
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
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        context.findAncestorStateOfType<MainScreenState>()?.setIndex(2);
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

              const SizedBox(height: 12),

              // 2. Outer Card Container with exact Login Box Stroke & Gradient
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18.0),
                child: RepaintBoundary(
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
                          // 3 Tabs in Row with custom flex so "شروع شده" displays completely
                          Row(
                            children: [
                              // Tab 1: جدید (fir01.svg - Green)
                              Expanded(
                                flex: 9,
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
                              const SizedBox(width: 6),

                              // Tab 2: شروع شده (fir02.svg - Amber/Orange) - Larger flex to fit text
                              Expanded(
                                flex: 13,
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
                              const SizedBox(width: 6),

                              // Tab 3: تمام شده (fir03.svg - Slate/Purple)
                              Expanded(
                                flex: 9,
                                child: _buildTabPill(
                                  type: ChallengeTabType.expired,
                                  title: 'تمام شده',
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
                          _buildItemsList(repository),
                        ],
                      ),
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

  /// Builds individual Tab Pill Button: right-aligned icon and text in RTL, fixed size
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
        height: 42,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(21),
          gradient: isSelected ? selectedGradient : null,
          color: isSelected ? null : unselectedColor,
          border: Border.all(
            color: isSelected ? borderColor : borderColor.withValues(alpha: 0.3),
            width: 1.2,
          ),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 6,
          vertical: 3,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // 1. Right side in RTL: Circular Flame Badge
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: badgeColor,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: SvgPicture.asset(
                  iconPath,
                  width: 13,
                  height: 16,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(width: 5),

            // 2. Title text (Center-aligned within the tab pill without affecting icon)
            Expanded(
              child: Text(
                title,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
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

  /// The latest challenges of the active tab, read from the challenges the server returned for this
  /// user (already scoped to their caravan/mentor/admin), using the same status as the challenges page:
  /// جدید = not answered yet, شروع شده = waiting for the mentor or sent back for correction,
  /// منقضی = deadline passed (approved ones are listed here too, so nothing disappears).
  Widget _buildItemsList(AppRepository repository) {
    final List<_ChallengeItemData> items = [];
    for (final c in repository.challenges) {
      final status = repository.challengeStatus(c);
      final bool inTab = switch (_selectedTab) {
        ChallengeTabType.newChallenges => status == 'new',
        ChallengeTabType.inProgress => status == 'pending' || status == 'rejected',
        ChallengeTabType.expired => status == 'expired' || status == 'completed',
      };
      if (inTab) items.add(_ChallengeItemData(id: c.id, title: c.title, status: status));
      if (items.length == 2) break;
    }

    if (items.isEmpty) {
      final String emptyText = switch (_selectedTab) {
        ChallengeTabType.newChallenges => 'چالش جدیدی وجود ندارد',
        ChallengeTabType.inProgress => 'چالشی در حال بررسی یا اصلاح ندارید',
        ChallengeTabType.expired => 'چالش تمام‌شده‌ای وجود ندارد',
      };
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Text(
          emptyText,
          style: const TextStyle(
            color: Color(0xFF9D99B8),
            fontSize: 12,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      );
    }

    return Column(
      children: items.map((item) => _buildChallengeItemRow(item)).toList(),
    );
  }

  /// Builds an individual Challenge item row (Grayscale & locked if expired)
  Widget _buildChallengeItemRow(_ChallengeItemData item) {
    final bool isExpired = item.status == 'expired';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      height: 52,
      decoration: BoxDecoration(
        gradient: isExpired
            ? const LinearGradient(
                colors: [Color(0xFF42424E), Color(0xFF282832)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: isExpired
              ? const LinearGradient(
                  colors: [Color(0xFF25252D), Color(0xFF1B1B22)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(13),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: InkWell(
          // Every challenge, even an expired or completed one, opens in the challenges page
          onTap: () => context.findAncestorStateOfType<MainScreenState>()?.setIndex(2),
          borderRadius: BorderRadius.circular(13),
          child: Row(
            children: [
              // Right: Circular Avatar Badge with champun / trophy SVG (Grayscale if expired)
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isExpired ? const Color(0xFF383842) : const Color(0xFF332F5C),
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(5),
                child: Center(
                  child: SvgPicture.asset(
                    'assets/svg_icons/champun01.svg',
                    fit: BoxFit.contain,
                    colorFilter: isExpired
                        ? const ColorFilter.mode(Color(0xFF7A7A88), BlendMode.srcIn)
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Title (Muted gray if expired)
              Expanded(
                child: Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isExpired ? const Color(0xFF7E7E8E) : Colors.white,
                    fontSize: 12,
                    fontWeight: isExpired ? FontWeight.normal : FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // Far Left (in RTL): "مشاهده" Button (Grayscale if expired)
              Container(
                decoration: BoxDecoration(
                  gradient: isExpired
                      ? const LinearGradient(
                          colors: [Color(0xFF4A4A55), Color(0xFF353540)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : AppColors.strokeGradient,
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.all(AppColors.borderWidth),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: isExpired
                        ? const LinearGradient(
                            colors: [Color(0xFF282830), Color(0xFF1E1E24)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : AppColors.darkSurfaceGradient,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    switch (item.status) {
                      'expired' => 'تمام شده',
                      'completed' => 'تکمیل',
                      'rejected' => 'اصلاح',
                      _ => 'مشاهده',
                    },
                    style: TextStyle(
                      color: isExpired ? const Color(0xFF787886) : const Color(0xFFC7B299),
                      fontSize: 10,
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
      ),
    );
  }
}

class _ChallengeItemData {
  final String id;
  final String title;
  final String status;

  const _ChallengeItemData({
    required this.id,
    required this.title,
    required this.status,
  });
}
