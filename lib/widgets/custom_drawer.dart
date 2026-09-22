import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import '../core/theme/app_theme.dart';
import 'contact_us_dialog.dart';
import 'logout_dialog.dart';
import 'complete_profile_dialog.dart';

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

  void _showGuideDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: const Color(0xFF1E1435),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
            width: 1.2,
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(22),
          constraints: const BoxConstraints(maxWidth: 400),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        SvgPicture.asset(
                          'assets/svg_icons/Manual01.svg',
                          width: 24,
                          height: 24,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'راهنمای سامانه نپا',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  'به کاروان یادگیری نپا خوش آمدید!\n\n'
                  '🔹 **آموزگاه:** مشاهده نقشه‌ی سفر، گذراندن منزلگاه‌ها و جلسات مهارتی و رسانه‌ای.\n'
                  '🔹 **چالش‌ها:** حل ماموریت‌ها و ارسال پاسخ جهت ارزیابی توسط راهبر کاروان.\n'
                  '🔹 **بازارچه:** خرج سکه و جوایز کسب‌شده برای خرید تجهیزات و پاداش‌ها.\n'
                  '🔹 **پشتیبانی:** ارتباط سریع با راهبر کاروان و کارشناسان نپا.',
                  style: TextStyle(
                    color: Color(0xFFD3D0E3),
                    fontSize: 12.5,
                    height: 1.7,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC09268),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text(
                    'متوجه شدم',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      fontFamily: AppTheme.fontFamily,
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

  @override
  Widget build(BuildContext context) {
    final isMentor = role == UserRole.mentor || role == UserRole.superMentor;
    final currentUser = Provider.of<AppRepository>(context).currentUser;

    final String displayName = currentUser.name.trim().isNotEmpty
        ? currentUser.name
        : (isMentor ? 'راهبر کاروان' : 'کمیل عباس');

    final String displaySubtitle = currentUser.caravanName != null &&
            currentUser.caravanName!.isNotEmpty &&
            currentUser.caravanName != 'فاقد کاروان'
        ? 'عضو ${currentUser.caravanName}'
        : (isMentor ? 'راهبر ارشد کاروان' : 'عضو کاروان شماره پنجم');

    return Drawer(
      backgroundColor: const Color(0xFF19172B),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            stops: [0.0, 0.45, 1.0],
            colors: [
              Color(0xFF24203D),
              Color(0xFF1A172D),
              Color(0xFF131122),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),

              // 1. Profile Header with Avatar on the Right and Name/Role on the Left
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22.0, vertical: 10.0),
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // User Info (Left of Avatar)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              displayName,
                              textAlign: TextAlign.right,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              displaySubtitle,
                              textAlign: TextAlign.right,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFF9D99B8),
                                fontSize: 12,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),

                      // Avatar with edit badge
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF47436B),
                              border: Border.all(
                                color: const Color(0xFF676296),
                                width: 2.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: (currentUser.avatarUrl != null && currentUser.avatarUrl!.isNotEmpty)
                                  ? CachedNetworkImage(
                                      imageUrl: currentUser.avatarUrl!,
                                      fit: BoxFit.cover,
                                      errorWidget: (context, url, error) => _buildAvatarPlaceholder(),
                                    )
                                  : _buildAvatarPlaceholder(),
                            ),
                          ),

                          // Small golden edit pencil badge
                          Positioned(
                            bottom: 0,
                            left: 0,
                            child: GestureDetector(
                              onTap: () {
                                Navigator.pop(context);
                                CompleteProfileDialog.show(context, currentUser);
                              },
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFFC7A17A),
                                  border: Border.all(
                                    color: const Color(0xFF1F1D33),
                                    width: 1.8,
                                  ),
                                ),
                                child: const Center(
                                  child: Icon(
                                    Icons.edit_rounded,
                                    size: 10,
                                    color: Color(0xFF332011),
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
              ),

              // Subtle Gradient Divider
              _buildGradientDivider(),

              // 2. Menu Navigation Items List
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  children: [
                    // Group 1: Main Tabs
                    _buildMenuItem(
                      title: 'پروفایل',
                      svgPath: 'assets/svg_icons/profile01.svg',
                      iconSize: 22,
                      onTap: () {
                        Navigator.pop(context);
                        onTabSelected(isMentor ? 3 : 4);
                      },
                    ),
                    _buildMenuItem(
                      title: 'آموزگاه',
                      svgPath: 'assets/svg_icons/classes01.svg',
                      iconColor: const Color(0xFFDEB58A), // Warm sand tone matching folded map
                      iconSize: 24,
                      onTap: () {
                        Navigator.pop(context);
                        onTabSelected(1);
                      },
                    ),
                    _buildMenuItem(
                      title: 'چالش ها',
                      svgPath: 'assets/svg_icons/challeng01.svg',
                      iconSize: 23,
                      onTap: () {
                        Navigator.pop(context);
                        onTabSelected(2);
                      },
                    ),
                    _buildMenuItem(
                      title: 'بازارچه',
                      svgPath: 'assets/svg_icons/stor01.svg',
                      iconSize: 23,
                      onTap: () {
                        Navigator.pop(context);
                        onTabSelected(3);
                      },
                    ),
                    _buildMenuItem(
                      title: 'برترین ها',
                      svgPath: 'assets/svg_icons/champun01.svg',
                      iconSize: 24,
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/mentor_league');
                      },
                    ),

                    // Middle Gradient Divider
                    _buildGradientDivider(),

                    // Group 2: Support, Help & Exit
                    _buildMenuItem(
                      title: 'پشتیبانی',
                      svgPath: 'assets/svg_icons/Support01.svg',
                      iconSize: 23,
                      onTap: () {
                        Navigator.pop(context);
                        ContactUsDialog.show(context);
                      },
                    ),
                    _buildMenuItem(
                      title: 'راهنما',
                      svgPath: 'assets/svg_icons/Manual01.svg',
                      iconSize: 22,
                      onTap: () {
                        Navigator.pop(context);
                        _showGuideDialog(context);
                      },
                    ),
                    _buildMenuItem(
                      title: 'خروج از حساب',
                      svgPath: 'assets/svg_icons/exit01.svg',
                      iconSize: 22,
                      onTap: () {
                        Navigator.pop(context);
                        LogoutDialog.show(context);
                      },
                    ),

                    // Admin / Dual Role Switcher (if applicable)
                    if (currentUser.isDualRole || currentUser.role == UserRole.admin) ...[
                      _buildGradientDivider(),
                      _buildMenuItem(
                        title: isMentor ? 'تغییر به پنل دانش‌آموز' : 'تغییر به پنل راهبر',
                        svgPath: 'assets/svg_icons/profile01.svg',
                        iconColor: const Color(0xFFD946EF),
                        textColor: const Color(0xFFD946EF),
                        iconSize: 20,
                        onTap: () {
                          Navigator.pop(context);
                          final targetRole = isMentor ? UserRole.member : UserRole.mentor;
                          Provider.of<AppRepository>(context, listen: false).setActiveRole(targetRole);
                          onTabSelected(0);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatarPlaceholder() {
    return Center(
      child: SvgPicture.asset(
        'assets/svg_icons/profile01.svg',
        width: 38,
        height: 38,
        fit: BoxFit.contain,
      ),
    );
  }

  Widget _buildGradientDivider() {
    return Container(
      height: 1,
      margin: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.0),
            Colors.white.withValues(alpha: 0.12),
            Colors.white.withValues(alpha: 0.0),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required String title,
    required String svgPath,
    required VoidCallback onTap,
    Color? iconColor,
    Color textColor = const Color(0xFFEDE8F5),
    double iconSize = 24.0,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        hoverColor: Colors.white.withValues(alpha: 0.04),
        splashColor: Colors.white.withValues(alpha: 0.08),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              children: [
                // Text Label on the left in RTL (aligned right towards icon)
                Expanded(
                  child: Text(
                    title,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ),
                const SizedBox(width: 18),

                // Icon on the right in RTL
                SizedBox(
                  width: 32,
                  height: 32,
                  child: Center(
                    child: SvgPicture.asset(
                      svgPath,
                      width: iconSize,
                      height: iconSize,
                      fit: BoxFit.contain,
                      colorFilter: iconColor != null
                          ? ColorFilter.mode(iconColor, BlendMode.srcIn)
                          : null,
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
}
