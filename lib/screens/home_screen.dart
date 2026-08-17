import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import '../models/station.dart';
import '../widgets/floating_assets_card.dart';
import '../widgets/station_card.dart';
import '../widgets/education_calendar.dart';
import '../widgets/jarchi_item.dart';
import '../widgets/nopa_notification_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<Station> _stations = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final stationsData = await HttpApiService().getStations();
      if (mounted) {
        setState(() {
          _stations = stationsData.map((s) => Station(
            id: s['id'] ?? '',
            title: s['title'] ?? 'بدون عنوان',
            teacher: s['teacher'] ?? 'استاد',
            progress: (s['progress'] ?? 0).toDouble(),
            isLocked: s['isLocked'] ?? false,
            isCurrent: s['isCurrent'] ?? false,
            imageUrl: s['imageUrl'] ?? 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400',
            classesCount: s['classesCount'] ?? '۴ کلاس',
          )).toList();
          
          if (_stations.isEmpty) {
            // Mock data for visual layout demonstration if API returns empty
            _stations = [
              Station(
                id: '1',
                title: 'آینه',
                teacher: 'استاد علوی',
                progress: 1.0,
                isLocked: false,
                isCurrent: false,
                imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
                classesCount: '۵ کلاس',
              ),
              Station(
                id: '2',
                title: 'دوربین تک‌چشمی',
                teacher: 'استاد رضایی',
                progress: 0.4,
                isLocked: false,
                isCurrent: true,
                imageUrl: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=400',
                classesCount: '۴ کلاس',
              ),
              Station(
                id: '3',
                title: 'اسطرلاب',
                teacher: 'استاد',
                progress: 0.0,
                isLocked: true,
                isCurrent: false,
                imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400',
                classesCount: '۶ کلاس',
              ),
            ];
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'خطا در دریافت اطلاعات';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppRepository>(context);
    final user = appState.currentUser;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(_errorMessage!, style: const TextStyle(fontSize: 16, color: Colors.white)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchData,
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Builder(
          builder: (context) {
            return IconButton(
              icon: const Icon(Icons.menu, color: Colors.white),
              onPressed: () {
                Scaffold.of(context).openDrawer();
              },
            );
          }
        ),
        actions: [
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_none, color: Colors.white),
                if (appState.unreadNotificationsCount > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${appState.unreadNotificationsCount}',
                        style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () {
              NopaNotificationDialog.show(context);
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildTopHeroSection(user),
              const SizedBox(height: 24),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24.0),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'منزلگاه‌های آموزشی',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Vazirmatn'),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _buildStationsCarousel(),
              const SizedBox(height: 32),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24.0),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'تقویم آموزشی نپا',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Vazirmatn'),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0),
                child: EducationCalendar(),
              ),
              const SizedBox(height: 32),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24.0),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'جارچی (اعلانات رسمی)',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Vazirmatn'),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _buildJarchiAnnouncements(),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopHeroSection(UserModel user) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: 240,
          width: double.infinity,
          decoration: const BoxDecoration(
            image: DecorationImage(
              image: NetworkImage('https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'),
              fit: BoxFit.cover,
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(40),
              bottomRight: Radius.circular(40),
            ),
          ),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF26123D).withValues(alpha: 0.6),
                  const Color(0xFF160E2A).withValues(alpha: 0.9),
                ],
              ),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(40),
                bottomRight: Radius.circular(40),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 32,
                      backgroundColor: Colors.white24,
                      backgroundImage: user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
                      child: user.avatarUrl == null ? const Icon(Icons.person, size: 36, color: Colors.white) : null,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.name,
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Vazirmatn'),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFD54F).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.5)),
                            ),
                            child: const Text(
                              'عضو کاروان یاوران علاءالملک 🐫',
                              style: TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const Positioned(
          bottom: -30,
          left: 0,
          right: 0,
          child: FloatingAssetsCard(),
        ),
      ],
    );
  }

  Widget _buildStationsCarousel() {
    return SizedBox(
      height: 280,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        reverse: true, // RTL layout
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: _stations.length,
        itemBuilder: (context, index) {
          final station = _stations[index];
          return StationCard(
            station: station,
            onTap: () {
              if (!station.isLocked) {
                Navigator.pushNamed(context, '/station_detail', arguments: station);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('این منزلگاه قفل است', style: TextStyle(fontFamily: 'Vazirmatn'))),
                );
              }
            },
          );
        },
      ),
    );
  }

  Widget _buildJarchiAnnouncements() {
    final List<Map<String, String>> announcements = [
      {
        'title': 'آغاز فصل دوم نپا',
        'date': '۱۴۰۵/۰۲/۱۵',
        'imageUrl': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400',
        'content': 'با سلام به تمامی دانش‌پژوهان عزیز، فصل دوم رویدادهای سرزمین نپا با منزلگاه‌های جدید آغاز شد.',
        'link': 'https://nopa.ir/news/1',
      },
      {
        'title': 'جلسه توجیهی آنلاین',
        'date': '۱۴۰۵/۰۲/۱۰',
        'imageUrl': 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400',
        'content': 'جلسه توجیهی آنلاین برای آشنایی با چالش‌های جدید هفته آینده برگزار خواهد شد.',
      },
    ];

    return Column(
      children: announcements.map((ann) => JarchiItem(
        title: ann['title']!,
        date: ann['date']!,
        imageUrl: ann['imageUrl']!,
        content: ann['content']!,
        link: ann['link'],
      )).toList(),
    );
  }
}
