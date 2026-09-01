import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import '../models/station.dart';
import '../widgets/floating_assets_card.dart';
import '../widgets/education_calendar.dart';
import '../widgets/jarchi_item.dart';
import '../widgets/station_card.dart';
import '../widgets/nopa_notification_dialog.dart';
import '../widgets/safe_avatar.dart';
import '../main.dart'; // For MainScreenState

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _news = [];
  List<Map<String, dynamic>> _banners = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        HttpApiService().getStations(),
        HttpApiService().getNews(),
        HttpApiService().getBanners(position: 'home_top'),
      ]);
      if (mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(results[0] as List);
          _news = List<Map<String, dynamic>>.from(results[1] as List);
          _banners = List<Map<String, dynamic>>.from(results[2] as List);
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

  Widget _buildBackdropHeader(UserModel? user) {
    final bannerImageUrl = _banners.isNotEmpty 
        ? HttpApiService().resolveMediaUrl(_banners[0]['imageUrl']) 
        : 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800';

    return Container(
      height: 240,
      width: double.infinity,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: NetworkImage(bannerImageUrl),
          onError: (e, s) => debugPrint('Banner image failed to load'),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.black54, Color(0xFF0F081D)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Left: Menu & Notification Icons (Forced LTR)
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => Scaffold.of(context).openDrawer(),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(color: Colors.black38, shape: BoxShape.circle),
                            child: const Icon(Icons.menu, color: Colors.white, size: 20),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () {
                            NopaNotificationDialog.show(context);
                          },
                          child: Stack(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(color: Colors.black38, shape: BoxShape.circle),
                                child: const Icon(Icons.notifications_none, color: Colors.white, size: 20),
                              ),
                              Positioned(
                                right: 0,
                                top: 0,
                                child: Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(color: Colors.redAccent, shape: BoxShape.circle),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Right: Profile info & Avatar
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(user?.name ?? 'کاربر', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFF97316).withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                            child: const Text('دانش‌آموز', style: TextStyle(color: Color(0xFFF97316), fontSize: 10)),
                          ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      SafeAvatar(
                        radius: 24,
                        imageUrl: user?.avatarUrl,
                        name: user?.name ?? 'کاربر',
                        backgroundColor: const Color(0xFF2C224D),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppRepository>(context);
    final user = appState.currentUser;

    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F081D),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFD946EF))),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F081D),
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
                child: const Text('تلاش مجدد', style: TextStyle(fontFamily: 'Vazirmatn')),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Top Hero Banner & Header with 2. Floating Assets Card Overlaid
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.bottomCenter,
                children: [
                  _buildBackdropHeader(user),
                  const Positioned(
                    bottom: -30,
                    left: 20,
                    right: 20,
                    child: FloatingAssetsCard(),
                  ),
                ],
              ),
              const SizedBox(height: 60), // Spacing for floating card
              
              // 3. Educational Stations Carousel
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('منزلگاه‌های آموزشی', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    TextButton(onPressed: () {
                      context.findAncestorStateOfType<MainScreenState>()?.setIndex(1); // 1 is MapScreen
                    }, child: const Text('نقشه کامل', style: TextStyle(color: Color(0xFFD946EF), fontFamily: 'Vazirmatn'))),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 170,
                child: _stations.isEmpty
                    ? const Center(child: Text('منزلگاهی یافت نشد', style: TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn')))
                    : ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _stations.length,
                        itemBuilder: (context, index) {
                          final stationMap = _stations[index];
                          final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
                          bool isLocked = index > 0 && (index + 1) > userLevelFrame && index > user.completedStationsCount;
                          bool isCurrent = (index + 1) == userLevelFrame || (index == 0 && userLevelFrame <= 1);
                          bool isCompleted = (index + 1) < userLevelFrame || index < user.completedStationsCount;

                          final String teacherName = stationMap['instructors']?.toString() ??
                              stationMap['subtitle']?.toString() ??
                              stationMap['teacher']?.toString() ??
                              'استاد کاروان نپا';
                          final String iconUrl = (stationMap['iconUrl'] != null && stationMap['iconUrl'].toString().startsWith('http'))
                              ? stationMap['iconUrl'].toString()
                              : ((stationMap['imageUrl'] != null && stationMap['imageUrl'].toString().startsWith('http'))
                                  ? stationMap['imageUrl'].toString()
                                  : 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=400');

                          final station = Station(
                            id: stationMap['id'] ?? index.toString(),
                            title: stationMap['title'] ?? 'منزلگاه ${index + 1}',
                            subtitle: stationMap['subtitle']?.toString(),
                            teacher: teacherName,
                            progress: isCompleted ? 1.0 : (isCurrent ? 0.3 : 0.0),
                            isLocked: isLocked,
                            isCurrent: isCurrent,
                            imageUrl: iconUrl,
                          );

                          return Padding(
                            padding: const EdgeInsets.only(right: 12.0),
                            child: StationCard(
                              station: station,
                              onTap: () {
                                if (!isLocked) {
                                  Navigator.pushNamed(context, '/station_detail', arguments: station);
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('این منزلگاه هنوز بازگشایی نشده است', style: TextStyle(fontFamily: 'Vazirmatn'))),
                                  );
                                }
                              },
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 24),

              // 4. Jalali Education Calendar
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20.0),
                child: EducationCalendar(),
              ),
              const SizedBox(height: 24),

              // 5. Jarchi Announcements List
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 0.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20.0),
                      child: Text('تابلوی اعلانات (جارچی)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 12),
                    if (_news.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20.0),
                        child: Text('بدون خبر', style: TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn')),
                      )
                    else
                      ..._news.map((newsItem) {
                        final date = DateTime.tryParse(newsItem['createdAt'] ?? '');
                        final dateStr = date != null ? '${date.year}/${date.month}/${date.day}' : 'نامشخص';
                        final imageUrl = newsItem['imageUrl'] != null ? '${HttpApiService().baseUrl.replaceAll('/api/v1', '')}${newsItem['imageUrl']}' : 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400';
                        return JarchiItem(
                          title: newsItem['title'] ?? 'بدون عنوان',
                          date: dateStr,
                          imageUrl: imageUrl,
                          content: newsItem['body'] ?? '',
                          link: newsItem['reporter'],
                        );
                      }),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
