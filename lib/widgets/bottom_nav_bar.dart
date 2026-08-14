import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../models/user_model.dart';

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

    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: onTap,
        backgroundColor: Colors.transparent,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppColors.purple,
        unselectedItemColor: Colors.white38,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontSize: 12),
        items: isMentor
            ? [
                _buildItem(Icons.dashboard_outlined, Icons.dashboard, 'میز کار'),
                _buildItem(Icons.people_outline, Icons.people, 'اعضا'),
                _buildItem(Icons.assignment_outlined, Icons.assignment, 'تکالیف'),
                _buildItem(Icons.person_outline, Icons.person, 'پروفایل'),
              ]
            : [
                _buildItem(Icons.home_outlined, Icons.home, AppStrings.navHome),
                _buildItem(Icons.map_outlined, Icons.map, AppStrings.navMap),
                _buildItem(Icons.emoji_events_outlined, Icons.emoji_events, AppStrings.navChallenges),
                _buildItem(Icons.shopping_bag_outlined, Icons.shopping_bag, AppStrings.navMarket),
                _buildItem(Icons.person_outline, Icons.person, AppStrings.navProfile),
              ],
      ),
    );
  }

  BottomNavigationBarItem _buildItem(IconData icon, IconData activeIcon, String label) {
    return BottomNavigationBarItem(
      icon: Icon(icon),
      activeIcon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppColors.purple.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(activeIcon),
      ),
      label: label,
    );
  }
}
