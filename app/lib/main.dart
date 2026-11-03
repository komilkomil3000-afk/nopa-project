import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
export 'screens/shell/app_shell.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'utils/constants.dart';
import 'services/api_service.dart';
import 'services/local_cache.dart';
import 'services/app_state_repository.dart';
import 'core/theme/app_theme.dart';
import 'services/theme_provider.dart';

// Authenticated Shell & Feature Screens
import 'screens/shell/app_shell.dart';
import 'screens/auth/login_screen.dart';
import 'screens/student/academy/student_class1_screen.dart';
import 'screens/student/academy/student_class2_screen.dart';
import 'package:nopa_app/screens/student/messages/student_notifications_screen.dart';
import 'models/station.dart';
import 'screens/mentor/profile/mentor_achievements_screen.dart';
import 'screens/mentor/profile/mentor_caravans_roster_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  PaintingBinding.instance.imageCache.maximumSize = 100;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 50 * 1024 * 1024; // 50MB ceiling
  GoogleFonts.config.allowRuntimeFetching = false;
  await LocalCache.instance.init();

  // Setup automatic 401 unauthorized token invalidation & safe login redirect
  HttpApiService.onUnauthorized = () {
    debugPrint('🚨 [Auth] Routing to /auth due to unauthorized session');
    AppRepository().handleUnauthorized();
    final navState = navigatorKey.currentState;
    if (navState != null && navState.mounted) {
      navState.pushNamedAndRemoveUntil(AppRoutes.auth, (route) => false);
    }
  };

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('Caught Flutter UI Error: ${details.exception}');
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    debugPrint('🚨 [PlatformDispatcher] Prevented app crash from async error: $error');
    return true;
  };
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppRepository()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider.value(value: ChatRepository.instance),
      ],
      child: const NepaApp(),
    ),
  );

  // Defer background health check after first frame so SurfaceView attaches immediately
  WidgetsBinding.instance.addPostFrameCallback((_) {
    HttpApiService().checkBackendHealth();
  });
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
      onPointerUp: (_) => AppRepository().recordActivity(),
      onPointerHover: (_) => AppRepository().recordActivity(),
      onPointerPanZoomStart: (_) => AppRepository().recordActivity(),
      onPointerPanZoomUpdate: (_) => AppRepository().recordActivity(),
      onPointerSignal: (_) => AppRepository().recordActivity(),
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
        initialRoute: AppRoutes.auth,
        routes: {
          AppRoutes.auth: (context) => const LoginScreen(),
          AppRoutes.main: (context) => const AppShell(),
          AppRoutes.dashboard: (context) => const AppShell(),
          AppRoutes.class1: (context) => _class1Screen(ModalRoute.of(context)?.settings.arguments),
          AppRoutes.stationDetail: (context) => _class1Screen(ModalRoute.of(context)?.settings.arguments),
          AppRoutes.class2: (context) => const StudentClass2Screen(),
          AppRoutes.mentorLeague: (context) => const MentorAchievementsScreen(),
          AppRoutes.mentorMembers: (context) => const MentorCaravansRosterScreen(),
          AppRoutes.tickets: (context) => const StudentNotificationsScreen(),
          AppRoutes.notifications: (context) => const StudentNotificationsScreen(),
        },
        onGenerateRoute: (settings) {
          final uri = Uri.tryParse(settings.name ?? '');
          if (uri != null && uri.path == AppRoutes.class1) {
            return MaterialPageRoute(
              settings: settings,
              builder: (context) => _class1Screen(settings.arguments),
            );
          }
          if (uri != null && uri.path == AppRoutes.class2) {
            return MaterialPageRoute(
              settings: settings,
              builder: (context) => const StudentClass2Screen(),
            );
          }
          return null;
        },
        onUnknownRoute: (settings) => MaterialPageRoute(
          settings: settings,
          builder: (context) => const AppShell(),
        ),
      ),
    );
  }
}

/// Shared builder for the '/class1' and '/station_detail' route aliases.
Widget _class1Screen(Object? args) {
  Station? initStation;
  if (args is Station) {
    initStation = args;
  } else if (args is Map<String, dynamic>) {
    initStation = Station.fromJson(args);
  }
  return StudentClass1Screen(initialStation: initStation);
}
