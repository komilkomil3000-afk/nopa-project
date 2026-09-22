import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
import '../main.dart';
import '../services/app_state_repository.dart';
import 'app_top_bar.dart';
import 'bottom_nav_bar.dart';
import 'custom_drawer.dart';

/// Global unified Scaffold / Shell for all pushed screens and sub-pages.
/// Ensures consistent background, TopBar, Drawer, and BottomNavBar layout.
class AppScaffold extends StatelessWidget {
  final Widget body;
  final bool showTopBar;
  final bool showBackButton;
  final bool showNotificationIcon;
  final bool showDrawerButton;
  final bool showBottomNavBar;
  final int currentBottomNavIndex;
  final VoidCallback? onBackTap;
  final Widget? drawer;

  const AppScaffold({
    super.key,
    required this.body,
    this.showTopBar = true,
    this.showBackButton = true,
    this.showNotificationIcon = true,
    this.showDrawerButton = true,
    this.showBottomNavBar = true,
    this.currentBottomNavIndex = -1,
    this.onBackTap,
    this.drawer,
  });

  @override
  Widget build(BuildContext context) {
    final userRole = Provider.of<AppRepository>(context, listen: false).currentUser.role;

    return Scaffold(
      backgroundColor: Colors.transparent,
      drawer: drawer ??
          (showDrawerButton
              ? CustomDrawer(
                  role: userRole,
                  currentIndex: currentBottomNavIndex,
                  onTabSelected: (idx) {
                    Navigator.pop(context);
                    Navigator.of(context).popUntil((route) => route.isFirst || route.settings.name == '/dashboard');
                    navigateToMainTab(idx);
                  },
                )
              : null),
      bottomNavigationBar: showBottomNavBar
          ? CustomBottomNavBar(
              currentIndex: currentBottomNavIndex,
              role: userRole,
              onTap: (idx) {
                if (Navigator.of(context).canPop()) {
                  Navigator.of(context).popUntil((route) => route.isFirst || route.settings.name == '/dashboard');
                }
                navigateToMainTab(idx);
              },
            )
          : null,
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
              if (showTopBar)
                AppTopBar(
                  showBackButton: showBackButton,
                  showNotificationIcon: showNotificationIcon,
                  showDrawerButton: showDrawerButton,
                  onBackTap: onBackTap,
                ),
              Expanded(child: body),
            ],
          ),
        ),
      ),
    );
  }
}
