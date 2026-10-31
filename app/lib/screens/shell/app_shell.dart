import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/utils/asset_precache_helper.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';
import 'package:nopa_app/widgets/custom_drawer.dart';
import 'package:nopa_app/widgets/app_top_bar.dart';

// Student screen imports
import 'package:nopa_app/screens/student/home/student_home_screen.dart';
import 'package:nopa_app/screens/student/academy/student_academy_roadmap_screen.dart';
import 'package:nopa_app/screens/student/challenges/student_challenges_screen.dart';
import 'package:nopa_app/screens/student/market/student_market_screen.dart';
import 'package:nopa_app/screens/student/profile/student_profile_screen.dart';

// Mentor screen imports
import 'package:nopa_app/screens/mentor/home/mentor_home_screen.dart';
import 'package:nopa_app/screens/mentor/academy/mentor_station_class1_screen.dart';
import 'package:nopa_app/screens/mentor/challenges/mentor_challenges_screen.dart';
import 'package:nopa_app/screens/mentor/market/mentor_market_screen.dart';
import 'package:nopa_app/screens/mentor/profile/mentor_profile_screen.dart';

final GlobalKey<MainScreenState> mainScreenKey = GlobalKey<MainScreenState>();
final ValueNotifier<int> mainTabNotifier = ValueNotifier<int>(0);

void navigateToMainTab(int index) {
  mainTabNotifier.value = index;
  mainScreenKey.currentState?.setIndex(index);
}

/// App Shell / MainScreen: Unified container with top bar, indexed tabs and bottom nav
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => MainScreenState();
}


class MainScreenState extends State<AppShell> {
  int _currentIndex = 0;
  DateTime? _lastBackPressTime;

  @override
  void initState() {
    super.initState();
    _currentIndex = mainTabNotifier.value;
    mainTabNotifier.addListener(_handleTabNotifierChange);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        AssetPrecacheHelper.precacheCoreAssets(context);
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
      }
    });
  }

  void _handleTabNotifierChange() {
    if (mounted && _currentIndex != mainTabNotifier.value) {
      setState(() {
        _currentIndex = mainTabNotifier.value;
      });
    }
  }

  @override
  void dispose() {
    mainTabNotifier.removeListener(_handleTabNotifierChange);
    super.dispose();
  }

  void setIndex(int index) {
    mainTabNotifier.value = index;
    if (mounted && _currentIndex != index) {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final userRole = repository.currentUser.role;

    final List<Widget> screens = userRole == UserRole.mentor || userRole == UserRole.superMentor
        ? [
            const MentorHomeScreen(),
            const MentorStationClass1Screen(),
            const MentorChallengesScreen(),
            const MentorMarketScreen(),
            const MentorProfileScreen(),
          ]
        : [
            const StudentHomeScreen(),
            const StudentAcademyRoadmapScreen(),
            const StudentChallengesScreen(),
            const StudentMarketScreen(),
            const StudentProfileScreen(),
          ];

    if (_currentIndex >= screens.length) {
      _currentIndex = 0;
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        // If user is on Map, Challenges, Market, or Profile -> Return to Home (Index 0)
        if (_currentIndex != 0) {
          setState(() {
            _currentIndex = 0;
          });
          return;
        }

        // If user is on Home tab -> Require double back tap within 2 seconds to exit app
        final now = DateTime.now();
        if (_lastBackPressTime == null || now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'برای خروج از برنامه، دوباره دکمه برگشت را بزنید.',
                style: TextStyle(fontFamily: AppTheme.fontFamily),
              ),
              duration: Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
            ),
          );
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        drawer: CustomDrawer(
          role: userRole,
          currentIndex: _currentIndex,
          onTabSelected: (index) {
            setIndex(index);
          },
        ),
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
                AppTopBar(
                  showBackButton: _currentIndex != 0,
                  showNotificationIcon: true,
                  showDrawerButton: true,
                  onBackTap: () {
                    setState(() {
                      _currentIndex = 0;
                    });
                  },
                ),
                Expanded(
                  child: IndexedStack(index: _currentIndex, children: screens),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: CustomBottomNavBar(
          currentIndex: _currentIndex,
          role: userRole,
          onTap: (index) {
            setIndex(index);
          },
        ),
      ),
    );
  }
}

typedef MainScreen = AppShell;
