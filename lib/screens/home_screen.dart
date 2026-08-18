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
import '../main.dart'; // For MainScreenState

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final stations = await HttpApiService().getStations();
      if (mounted) {
        setState(() {
          _stations = stations;
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
    return Container(
      height: 240,
      width: double.infinity,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: NetworkImage('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800'),
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
                      CircleAvatar(
                        radius: 24,
                        backgroundImage: user?.avatarUrl != null ? NetworkImage(user!.avatarUrl!) : null,
                        backgroundColor: const Color(0xFF2C224D),
                        child: user?.avatarUrl == null ? const Icon(Icons.person, color: Colors.white) : null,
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
                          int userLevelFrame = user.levelFrame;
                          bool isLocked = (index + 1) > userLevelFrame;
                          bool isCurrent = (index + 1) == userLevelFrame;
                          bool isCompleted = (index + 1) < userLevelFrame;

                          final station = Station(
                            id: stationMap['id'] ?? index.toString(),
                            title: stationMap['title'] ?? 'بدون عنوان',
                            teacher: stationMap['subtitle'] ?? 'استاد نامشخص',
                            progress: isCompleted ? 1.0 : (isCurrent ? 0.3 : 0.0),
                            isLocked: isLocked,
                            isCurrent: isCurrent,
                            imageUrl: stationMap['imageUrl'] ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
                          );

                          return Padding(
                            padding: const EdgeInsets.only(right: 12.0),
                            child: StationCard(
                              station: station,
                              onTap: () {
                                if (!isLocked) {
                                  Navigator.pushNamed(context, '/station_detail', arguments: stationMap);
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
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('تابلوی اعلانات (جارچی)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    SizedBox(height: 12),
                    JarchiItem(
                      title: 'جلسه توجیهی ویژه کاروان‌های جدید',
                      date: 'دوشنبه ۱۸ مرداد ۱۴۰۲',
                      imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400',
                      content: 'به اطلاع تمامی دانش‌پژوهان می‌رساند جلسه توجیهی به صورت برخط برگزار خواهد شد.',
                    ),
                    SizedBox(height: 12),
                    JarchiItem(
                      title: 'آغاز چالش بزرگ کتابخوانی تابستانه',
                      date: 'شنبه ۱۵ مرداد ۱۴۰۲',
                      imageUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400',
                      content: 'چالش جدیدی در بخش مهارت‌ها با جوایز ارزنده (زریک و فرش) اضافه شد. برای شرکت اقدام کنید.',
                    ),
                    SizedBox(height: 40),
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
