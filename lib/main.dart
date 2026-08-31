import 'package:flutter/material.dart';
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

import 'services/theme_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = true;
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

TextTheme _buildTextTheme(TextTheme base, double scale) {
  return GoogleFonts.vazirmatnTextTheme(base.copyWith(
    displayLarge: (base.displayLarge ?? const TextStyle()).copyWith(fontSize: 57 * scale),
    displayMedium: (base.displayMedium ?? const TextStyle()).copyWith(fontSize: 45 * scale),
    displaySmall: (base.displaySmall ?? const TextStyle()).copyWith(fontSize: 36 * scale),
    headlineLarge: (base.headlineLarge ?? const TextStyle()).copyWith(fontSize: 32 * scale),
    headlineMedium: (base.headlineMedium ?? const TextStyle()).copyWith(fontSize: 28 * scale),
    headlineSmall: (base.headlineSmall ?? const TextStyle()).copyWith(fontSize: 24 * scale),
    titleLarge: (base.titleLarge ?? const TextStyle()).copyWith(fontSize: 22 * scale),
    titleMedium: (base.titleMedium ?? const TextStyle()).copyWith(fontSize: 16 * scale),
    titleSmall: (base.titleSmall ?? const TextStyle()).copyWith(fontSize: 14 * scale),
    bodyLarge: (base.bodyLarge ?? const TextStyle()).copyWith(fontSize: 16 * scale),
    bodyMedium: (base.bodyMedium ?? const TextStyle()).copyWith(fontSize: 14 * scale),
    bodySmall: (base.bodySmall ?? const TextStyle()).copyWith(fontSize: 12 * scale),
    labelLarge: (base.labelLarge ?? const TextStyle()).copyWith(fontSize: 14 * scale),
    labelMedium: (base.labelMedium ?? const TextStyle()).copyWith(fontSize: 12 * scale),
    labelSmall: (base.labelSmall ?? const TextStyle()).copyWith(fontSize: 11 * scale),
  ));
}

class NepaApp extends StatelessWidget {
  const NepaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return MaterialApp(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      themeMode: themeProvider.themeMode,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8F9FA),
        primaryColor: AppColors.purple,
        textTheme: _buildTextTheme(ThemeData.light().textTheme, themeProvider.fontScale),
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.purple,
          brightness: Brightness.light,
          surface: Colors.white,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.background,
        primaryColor: AppColors.purple,
        textTheme: _buildTextTheme(ThemeData.dark().textTheme, themeProvider.fontScale),
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.purple,
          brightness: Brightness.dark,
          surface: AppColors.cardBackground,
        ),
        useMaterial3: true,
      ),
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

  void setIndex(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

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

    return Scaffold(
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
    );
  }
}
