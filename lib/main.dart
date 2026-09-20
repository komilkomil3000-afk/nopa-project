import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'utils/constants.dart';
import 'services/api_service.dart';
import 'screens/auth_screen.dart';
import 'screens/success_screen.dart';
import 'screens/home_screen.dart';
import 'screens/map_screen.dart';
import 'screens/challenges_screen.dart';
import 'screens/market_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/station_detail_screen.dart';
import 'screens/class_player_screen.dart';
import 'screens/mentor_dashboard_screen.dart';
import 'screens/mentor_members_screen.dart';
import 'screens/mentor_tasks_screen.dart';
import 'screens/mentor_ratings_detail_screen.dart';
import 'screens/mentor_league_screen.dart';
import 'screens/mentor_workbench_screen.dart';
import 'screens/tickets_screen.dart';
import 'widgets/bottom_nav_bar.dart';
import 'widgets/custom_drawer.dart';
import 'models/user_model.dart';
import 'services/app_state_repository.dart';

import 'core/theme/app_theme.dart';
import 'services/theme_provider.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void navigateToMainTab(int index) {
  final ctx = navigatorKey.currentContext;
  if (ctx != null) {
    ctx.findAncestorStateOfType<MainScreenState>()?.setIndex(index);
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  // Setup automatic 401 unauthorized token invalidation & login redirect
  HttpApiService.onUnauthorized = () {
    debugPrint('🚨 [Auth] Routing to /auth due to 401 Unauthorized session expiry');
    AppRepository().handleUnauthorized();
    navigatorKey.currentState?.pushNamedAndRemoveUntil('/auth', (route) => false);
  };

  // Setup automatic 10-minute inactivity session timeout
  AppRepository.onSessionTimeout = () {
    debugPrint('⏱️ [Auth] Routing to /auth due to 10-minute inactivity timeout');
    AppRepository().handleUnauthorized();
    navigatorKey.currentState?.pushNamedAndRemoveUntil('/auth', (route) => false);
    final ctx = navigatorKey.currentContext;
    if (ctx != null) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(
          content: Text('به دلیل عدم فعالیت بیش از ۱۰ دقیقه، لطفاً مجدداً وارد شوید.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFFE11D48),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  };

  await HttpApiService().checkBackendHealth();

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('Caught Flutter UI Error: ${details.exception}');
  };
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppRepository()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const NepaApp(),
    ),
  );
}

class NepaApp extends StatelessWidget {
  const NepaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => AppRepository().recordActivity(),
      onPointerMove: (_) => AppRepository().recordActivity(),
      child: MaterialApp(
        navigatorKey: navigatorKey,
        title: AppStrings.appName,
        debugShowCheckedModeBanner: false,
        themeMode: themeProvider.themeMode,
        theme: AppTheme.lightTheme(themeProvider.fontScale),
        darkTheme: AppTheme.darkTheme(themeProvider.fontScale),
        // RTL Support for Persian (Farsi)
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('fa', 'IR')],
        locale: const Locale('fa', 'IR'),
        initialRoute: '/auth',
        routes: {
          '/auth': (context) => const AuthScreen(),
          '/main': (context) => const SuccessScreen(),
          '/dashboard': (context) => const MainScreen(),
          '/station_detail': (context) => const StationDetailScreen(),
          '/class_player': (context) => const ClassPlayerScreen(),
          '/mentor_ratings': (context) => const MentorRatingsDetailScreen(),
          '/mentor_league': (context) => const MentorLeagueScreen(),
          '/mentor_workbench': (context) => const MentorWorkbenchScreen(),
          '/tickets': (context) => const TicketsScreen(),
        },
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => MainScreenState();
}

class MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
      }
    });
  }

  void setIndex(int index) {
    if (mounted) {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  DateTime? _lastBackPressTime;

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final userRole = repository.currentUser.role;

    final List<Widget> screens = userRole == UserRole.mentor || userRole == UserRole.superMentor
        ? [
            const MentorDashboardScreen(),
            const MentorMembersScreen(),
            const MentorTasksScreen(),
            const ProfileScreen(),
          ]
        : [
            const HomeScreen(),
            const MapScreen(),
            const ChallengesScreen(),
            const MarketScreen(),
            const ProfileScreen(),
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
        drawer: CustomDrawer(
          role: userRole,
          currentIndex: _currentIndex,
          onTabSelected: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
        ),
        body: IndexedStack(index: _currentIndex, children: screens),
        bottomNavigationBar: CustomBottomNavBar(
          currentIndex: _currentIndex,
          role: userRole,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
        ),
      ),
    );
  }
}
