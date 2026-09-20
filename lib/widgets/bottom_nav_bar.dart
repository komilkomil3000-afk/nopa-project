import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/user_model.dart';
import '../utils/constants.dart';

class CustomBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final UserRole role;
  final Function(int) onTap;

  const CustomBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.role,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isMentor = role == UserRole.mentor || role == UserRole.superMentor;

    final List<_NavItemData> items = isMentor
        ? [
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_home.svg',
              fallbackIcon: Icons.dashboard_rounded,
              label: 'میز کار',
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_profile.svg',
              fallbackIcon: Icons.people_rounded,
              label: 'اعضا',
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_challenge.svg',
              fallbackIcon: Icons.assignment_rounded,
              label: 'تکالیف',
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_profile.svg',
              fallbackIcon: Icons.person_rounded,
              label: 'پروفایل',
            ),
          ]
        : [
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_home.svg',
              fallbackIcon: Icons.home_rounded,
              label: AppStrings.navHome,
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_learning.svg',
              fallbackIcon: Icons.map_rounded,
              label: AppStrings.navMap,
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_challenge.svg',
              fallbackIcon: Icons.local_fire_department_rounded,
              label: AppStrings.navChallenges,
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_market.svg',
              fallbackIcon: Icons.storefront_rounded,
              label: AppStrings.navMarket,
            ),
            const _NavItemData(
              iconPath: 'assets/svg_icons/nav_profile.svg',
              fallbackIcon: Icons.person_rounded,
              label: AppStrings.navProfile,
            ),
          ];

    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF282548),
            Color(0xFF1B1834),
          ],
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(
            color: const Color(0xFF656196).withValues(alpha: 0.55),
            width: 1.2,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      padding: EdgeInsets.only(
        top: 10,
        bottom: bottomPadding > 0 ? bottomPadding + 4 : 10,
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: List.generate(items.length, (index) {
            final isSelected = currentIndex == index;
            final item = items[index];

            return Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(index),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildNavIcon(item, isSelected),
                    const SizedBox(height: 6),
                    Text(
                      item.label,
                      style: TextStyle(
                        fontFamily: 'YekanBakh',
                        fontSize: 11.5,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected
                            ? const Color(0xFFEDE9F6)
                            : const Color(0xFF8B88A8),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _buildNavIcon(_NavItemData item, bool isSelected) {
    final Color iconColor = isSelected
        ? const Color(0xFFC7A280) // Warm gold/tan color from screenshot
        : const Color(0xFF7E7B9F); // Purple/lavender inactive color

    return SvgPicture.asset(
      item.iconPath,
      width: 26,
      height: 26,
      colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
      placeholderBuilder: (context) => Icon(
        item.fallbackIcon,
        size: 26,
        color: iconColor,
      ),
    );
  }
}

class _NavItemData {
  final String iconPath;
  final IconData fallbackIcon;
  final String label;

  const _NavItemData({
    required this.iconPath,
    required this.fallbackIcon,
    required this.label,
  });
}
