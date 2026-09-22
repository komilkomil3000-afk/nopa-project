import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';

/// Unified, fixed-size TopBar for the entire application.
/// Strictly adheres to the 2-tier layout:
/// - Left: "NOPA" gradient logo (Row 1) and Back SVG icon (Row 2).
/// - Right: Notification Bell button and Hamburger Drawer menu button.
class AppTopBar extends StatelessWidget {
  final bool showBackButton;
  final bool showNotificationIcon;
  final bool showDrawerButton;
  final VoidCallback? onBackTap;

  const AppTopBar({
    super.key,
    this.showBackButton = true,
    this.showNotificationIcon = true,
    this.showDrawerButton = true,
    this.onBackTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, top: 10, bottom: 6),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Column: NOPA Logo (Row 1) + Back Button (Row 2)
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
                if (showBackButton)
                  GestureDetector(
                    onTap: onBackTap ?? () => Navigator.of(context).maybePop(),
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
                  )
                else
                  const SizedBox(height: 26),
              ],
            ),

            // Right Row: Notification Bell + Hamburger Menu
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (showNotificationIcon) ...[
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
                ],
                if (showDrawerButton)
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
      ),
    );
  }
}
