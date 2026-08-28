import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import '../utils/tasks_repository.dart';
import '../utils/global_state.dart';
import '../widgets/safe_avatar.dart';
import 'contact_us_dialog.dart';

class CustomDrawer extends StatelessWidget {
  final Function(int) onTabSelected;
  final int currentIndex;
  final UserRole role;

  const CustomDrawer({
    super.key,
    required this.onTabSelected,
    required this.currentIndex,
    required this.role,
  });

  @override
  Widget build(BuildContext context) {
    final isMentor = role == UserRole.mentor || role == UserRole.superMentor;

    // Header Details
    final currentUser = Provider.of<AppRepository>(context).currentUser;
    final String displayName = currentUser.name;
    final String displayRole = isMentor ? 'راهبر ارشد سرزمین نپا 🚩' : 'طلایه‌دار کاروان';
    final String avatarUrl = isMentor 
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
    
    final level = isMentor ? GlobalState.mentorLevel : GlobalState.memberLevel;
    final frameColor = GlobalState.getLevelColor(level);
    final frameGlow = GlobalState.getLevelGlow(level);

    return Drawer(
      backgroundColor: const Color(0xFF0F081D),
      child: SafeArea(
        child: Column(
          children: [
            // Profile Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        displayName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      if (currentUser.userCode != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'شناسه: ${currentUser.userCode}',
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 12,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        displayRole,
                        style: const TextStyle(
                          color: Color(0xFFEC4899),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: frameColor, width: 2),
                      boxShadow: frameGlow,
                    ),
                    child: SafeAvatar(
                      radius: 27,
                      imageUrl: avatarUrl,
                      name: displayName,
                      backgroundColor: Colors.transparent,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white12, thickness: 1, indent: 24, endIndent: 24),
            
            // Sidebar Navigation List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _buildMenuItem(
                    title: isMentor ? 'پیشخوان راهبر' : 'منزلگاه‌ها',
                    emoji: '🏠',
                    isSelected: currentIndex == 0,
                    onTap: () {
                      Navigator.pop(context);
                      onTabSelected(0);
                    },
                  ),
                  _buildMenuItem(
                    title: isMentor ? 'اعضای کاروان' : 'نقشه کل',
                    emoji: isMentor ? '👥' : '🗺️',
                    isSelected: currentIndex == 1,
                    onTap: () {
                      Navigator.pop(context);
                      onTabSelected(1);
                    },
                  ),
                  _buildMenuItem(
                    title: isMentor ? 'تکالیف و چالش‌ها' : 'چالش‌های فعال',
                    emoji: '🏆',
                    isSelected: currentIndex == 2,
                    onTap: () {
                      Navigator.pop(context);
                      if (isMentor) {
                        TasksRepository.shouldAutoOpenCreateChallenge = true;
                      }
                      onTabSelected(2);
                    },
                  ),
                  if (!isMentor)
                    _buildMenuItem(
                      title: 'بازارچه زریک',
                      emoji: '🛒',
                      isSelected: currentIndex == 3,
                      onTap: () {
                        Navigator.pop(context);
                        onTabSelected(3);
                      },
                    ),
                  _buildMenuItem(
                    title: isMentor ? 'پروفایل راهبر' : 'پروفایل من',
                    emoji: '👤',
                    isSelected: isMentor ? currentIndex == 3 : currentIndex == 4,
                    onTap: () {
                      Navigator.pop(context);
                      onTabSelected(isMentor ? 3 : 4);
                    },
                  ),
                  
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.0),
                    child: Divider(color: Colors.white12, thickness: 1, indent: 8, endIndent: 8),
                  ),
                  
                  _buildMenuItem(
                    title: 'پشتیبانی و تماس با ما',
                    emoji: '📞',
                    isSelected: false,
                    onTap: () {
                      Navigator.pop(context);
                      ContactUsDialog.show(context);
                    },
                  ),
                  _buildMenuItem(
                    title: 'لیگ راهبران',
                    emoji: '🎖️',
                    isSelected: false,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, '/mentor_league');
                    },
                  ),
                  
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.0),
                    child: Divider(color: Colors.white12, thickness: 1, indent: 8, endIndent: 8),
                  ),
                  
                  _buildMenuItem(
                    title: 'خروج از حساب',
                    emoji: '🚪',
                    isSelected: false,
                    textColor: Colors.redAccent,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushReplacementNamed(context, '/auth');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required String title,
    required String emoji,
    required bool isSelected,
    required VoidCallback onTap,
    Color textColor = Colors.white,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFF1E1435) : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text(
              title,
              style: TextStyle(
                color: isSelected ? const Color(0xFFEC4899) : textColor,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 13,
                fontFamily: 'Vazirmatn',
              ),
            ),
            const SizedBox(width: 14),
            Text(
              emoji,
              style: const TextStyle(fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}
