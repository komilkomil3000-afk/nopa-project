import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/models/station.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/pending_challenges_dialog.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';
import 'package:nopa_app/widgets/station_progress_stepper.dart';
import 'package:nopa_app/main.dart';
import 'package:url_launcher/url_launcher.dart';

/// Class 1 Screen (صفحه اطلاعات و توضیحات منزلگاه)
class StudentClass1Screen extends StatefulWidget {
  final Station? initialStation;
  final VoidCallback? onBack;
  final bool isEmbeddedInMain;

  const StudentClass1Screen({
    super.key,
    this.initialStation,
    this.onBack,
    this.isEmbeddedInMain = false,
  });

  @override
  State<StudentClass1Screen> createState() => _Class1ScreenState();
}

/// Backwards compatibility alias
typedef StationDetailScreen = Class1Screen;

class _Class1ScreenState extends State<StudentClass1Screen> {
  Station? _station;
  List<Map<String, dynamic>> _allStationsData = [];
  Map<String, List<Map<String, dynamic>>> _classCategories = {};
  List<Map<String, dynamic>> _allClips = [];
  int _currentClipIndex = 0;
  bool _isDescriptionExpanded = false;
  int _currentStationIndex = 0;
  final Set<String> _expandedStatKeys = {};
  final PageController _videoPageController = PageController();

  @override
  void initState() {
    super.initState();
    if (widget.initialStation != null) {
      _station = widget.initialStation;
      _currentStationIndex = widget.initialStation!.orderIndex;
      _loadClassCategories();
    }
  }

  @override
  void didUpdateWidget(covariant Class1Screen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialStation != null && widget.initialStation != oldWidget.initialStation) {
      _station = widget.initialStation;
      _currentStationIndex = widget.initialStation!.orderIndex;
      _loadClassCategories();
    }
  }

  @override
  void dispose() {
    _videoPageController.dispose();
    super.dispose();
  }

  // Station lore, descriptions, and statistics
  static const Map<int, Map<String, String>> _stationLore = {
    0: {
      'ordinalTitle': 'منزلگاه ۰',
      'fullTitle': 'منزلگاه صفر (راهنمای کاروان)',
      'desc':
          'اینجا منزلگاه صفر، نقطه آغازین سفر کاروان نپا است. کاروانسرایی برای آشنایی، دریافت توشه‌ی راه و شناخت قوانین پیمایش. در این ایستگاه مقدماتی، راهبران مسیر و همراهان کاروان خود را خواهید شناخت و آماده ورود به صحرای ماجراجویی می‌شوید.',
      'skillSessions': '۱ جلسه',
      'mediaSessions': '۲ جلسه',
      'animationCount': '۱ قسمت',
      'stayDuration': '۵ روز',
      'clipTitle': 'انیمیشن مقدماتی راهنمای کاروان (منزلگاه ۰)',
    },
    1: {
      'ordinalTitle': 'منزلگاه ۱',
      'fullTitle': 'منزلگاه اول (کاروانسرای غبارگرفته)',
      'desc':
          'اینجا منزلگاه اول، جایی در مناطق حاشیه‌ای صحرای فراموشی است. کاروانسرای غبارگرفته‌ای که اکنون در آن اقامت گزیده‌ایم، همیشه مسافران تازه‌کار را غافلگیر می‌کند. دیوارهای اینجا همه از آیینه هایی ساخته شده‌اند که می‌توانند چیزی فراتر از ظاهر را نشان دهند. عمق فکر و علایق و آرزوهای ما. پیر آیینه گر، مرشد و استادی است که در این منزلگاه سکونت دارد. همه‌ی این آیینه های خارق‌العاده، به دست او ساخته شده‌اند...',
      'skillSessions': '۲ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': '۲ قسمت',
      'stayDuration': '۱۰ روز',
      'clipTitle': 'انیمیشن کاروانسرای غبارگرفته (منزلگاه ۱)',
    },
    2: {
      'ordinalTitle': 'منزلگاه ۲',
      'fullTitle': 'منزلگاه دوم (معدن زیرزمینی)',
      'desc':
          'اینجا منزلگاه دوم، در اعماق کوهستان‌های پر رمز و راز و معدن‌های باستانی است. جایی که سنگ‌های درخشان و ارزشمند در دل تاریکی نهفته‌اند. در این منزلگاه، مسافران یاد می‌گیرند که چگونه با تلاش و مهارت، گوهر استعدادها و توانمندی‌های خود را کشف و صیقل دهند.',
      'skillSessions': '۳ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': '۲ قسمت',
      'stayDuration': '۱۲ روز',
      'clipTitle': 'انیمیشن اسرار معدن زیرزمینی (منزلگاه ۲)',
    },
    3: {
      'ordinalTitle': 'منزلگاه ۳',
      'fullTitle': 'منزلگاه سوم (قلعه)',
      'desc':
          'اینجا منزلگاه سوم، قلعه‌ای با شکوه و استوار بر فراز صخره‌های کهن است. در این سنگر مستحکم، اعضای کاروان یاد می‌گیرند که چگونه در کنار یکدیگر به عنوان یک تیم متحد عمل کنند و در برابر چالش‌ها و بادهای سخت مقاومت ورزند.',
      'skillSessions': '۳ جلسه',
      'mediaSessions': '۵ جلسه',
      'animationCount': '۳ قسمت',
      'stayDuration': '۱۵ روز',
      'clipTitle': 'انیمیشن دفاع از قلعه کهن (منزلگاه ۳)',
    },
    4: {
      'ordinalTitle': 'منزلگاه ۴',
      'fullTitle': 'منزلگاه چهارم (دهکده ساحلی)',
      'desc':
          'اینجا منزلگاه چهارم، دهکده‌ای آرام و پرامید در کنار ساحل دریای بیکران است. در این منزلگاه، اعضای کاروان مهارت‌های برقراری ارتباط، داستان‌پردازی و خلق آثار مشترک را تمرین می‌کنند تا یادگاری ماندگار از خود بر جای گذارند.',
      'skillSessions': '۴ جلسه',
      'mediaSessions': '۴ جلسه',
      'animationCount': '۲ قسمت',
      'stayDuration': '۱۰ روز',
      'clipTitle': 'انیمیشن رویاهای دهکده ساحلی (منزلگاه ۴)',
    },
    5: {
      'ordinalTitle': 'منزلگاه ۵',
      'fullTitle': 'منزلگاه پنجم (فانوس دریایی)',
      'desc':
          'اینجا منزلگاه پنجم، فانوس دریایی فروزان و نقطه اوج سفر کاروان نپا است. نوری درخشان که افق‌های آینده را روشن می‌سازد. در این مقصد، مسافران ثمره تلاش‌ها و تجربیات خود را جشن گرفته و آماده رهبری مسیرهای آینده می‌شوند.',
      'skillSessions': '۴ جلسه',
      'mediaSessions': '۶ جلسه',
      'animationCount': '۴ قسمت',
      'stayDuration': '۲۰ روز',
      'clipTitle': 'انیمیشن روشنایی فانوس دریایی (منزلگاه ۵)',
    },
  };

  bool _isInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInitialized && _station == null && widget.initialStation == null) {
      _isInitialized = true;
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Station) {
        _station = args;
        _currentStationIndex = args.orderIndex;
      } else {
        final lore0 = _stationLore[0]!;
        _station = Station(
          id: '0',
          title: lore0['fullTitle'] ?? 'منزلگاه صفر (راهنمای کاروان)',
          teacher: 'استاد کاروان',
          progress: 0.0,
          isLocked: false,
          isCurrent: true,
          imageUrl: '',
          orderIndex: 0,
        );
        _currentStationIndex = 0;
      }
      _loadClassCategories();
    }
  }

  Future<void> _loadClassCategories() async {
    try {
      final stations = await HttpApiService().getStations();
      _allStationsData = List<Map<String, dynamic>>.from(stations);

      Map<String, dynamic> stationData = {};
      if (_allStationsData.isNotEmpty) {
        stationData = _allStationsData.firstWhere(
          (s) => (s['orderIndex'] == _currentStationIndex) || (s['id'] == _station?.id),
          orElse: () => _allStationsData.isNotEmpty ? _allStationsData[0] : {},
        );
      }

      final Map<String, List<Map<String, dynamic>>> map = {};
      final List<Map<String, dynamic>> clipsList = [];

      if (stationData.containsKey('categories') && stationData['categories'] != null) {
        final categoriesList = stationData['categories'] as List? ?? [];
        for (final item in categoriesList) {
          if (item is Map) {
            final cat = item as Map<String, dynamic>;
            final catTitle = cat['title']?.toString() ?? 'کلاس‌ها';
            final sessions = (cat['sessions'] as List?)?.map((s) => s as Map<String, dynamic>).toList() ?? [];
            map[catTitle] = sessions;

            for (final sess in sessions) {
              final clips = (sess['videoClips'] as List?)?.map((c) => c as Map<String, dynamic>).toList() ?? [];
              clipsList.addAll(clips);
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _classCategories = map;
          _allClips = clipsList;
          _currentClipIndex = 0;
        });
        if (_videoPageController.hasClients) {
          _videoPageController.jumpToPage(0);
        }
      }
    } catch (e) {
      debugPrint('Error loading station details: $e');
    }
  }

  void _switchStation(int index) {
    if (index == _currentStationIndex) return;
    setState(() {
      _currentStationIndex = index;
      _isDescriptionExpanded = false;

      final lore = _stationLore[index];
      _station = Station(
        id: index.toString(),
        title: lore?['fullTitle'] ?? 'منزلگاه $index',
        teacher: 'استاد منزلگاه',
        progress: 0.0,
        isLocked: false,
        isCurrent: true,
        imageUrl: '',
        orderIndex: index,
      );
    });
    _loadClassCategories();
  }

  bool _checkCanAccessContent(BuildContext context) {
    if (_station == null) return true;
    final appState = Provider.of<AppRepository>(context, listen: false);
    final isNewStation = _currentStationIndex > 0 && !_station!.isCompleted;
    if (isNewStation && appState.hasPendingChallenges) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('شما باید چالش‌هایتان را تکمیل کنید', style: TextStyle(fontFamily: AppTheme.fontFamily, fontWeight: FontWeight.bold)),
          backgroundColor: Colors.redAccent,
          duration: Duration(seconds: 3),
        ),
      );
      PendingChallengesDialog.show(context, appState.uncompletedChallengesCount);
      return false;
    }
    return true;
  }

  void _navigateToClass(String categoryKeyword) {
    if (!_checkCanAccessContent(context)) return;

    List<Map<String, dynamic>> targetSessions = [];
    for (var entry in _classCategories.entries) {
      if (entry.key.contains(categoryKeyword)) {
        targetSessions = entry.value;
        break;
      }
    }

    if (targetSessions.isEmpty && _classCategories.isNotEmpty) {
      targetSessions = _classCategories.values.first;
    }

    if (targetSessions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('جلسات $categoryKeyword برای این منزلگاه به زودی منتشر می‌شود.', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: const Color(0xFF28274A),
        ),
      );
      return;
    }

    Navigator.pushNamed(
      context,
      '/class2',
      arguments: {
        'classes': targetSessions,
        'initialIndex': 0,
      },
    );
  }

  Future<void> _contactMentor() async {
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    String targetUrl = (user.socialGroupLink != null && user.socialGroupLink!.trim().isNotEmpty)
        ? user.socialGroupLink!.trim()
        : 'https://eitaa.com/komeilgraph';

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      if (targetUrl.startsWith('@')) {
        targetUrl = 'https://eitaa.com/${targetUrl.substring(1)}';
      } else if (targetUrl.contains('eitaa.com') || targetUrl.contains('t.me') || targetUrl.contains('rubika.ir') || targetUrl.contains('bale.ai')) {
        targetUrl = 'https://$targetUrl';
      } else {
        targetUrl = 'https://eitaa.com/$targetUrl';
      }
    }

    try {
      final uri = Uri.parse(targetUrl);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'خطا در باز کردن لینک راهبر: $targetUrl',
              style: const TextStyle(fontFamily: AppTheme.fontFamily),
            ),
            backgroundColor: const Color(0xFFE11D48),
          ),
        );
      }
    }
  }

  void _handleBackAction() {
    if (widget.onBack != null) {
      widget.onBack!();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      navigateToMainTab(1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lore = _stationLore[_currentStationIndex] ?? _stationLore[1]!;
    final user = Provider.of<AppRepository>(context).currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int totalStationNodes = _allStationsData.isNotEmpty ? _allStationsData.length : 6;

    // Check if selected station is locked
    final bool isLocked = _currentStationIndex > 0 &&
        (_currentStationIndex + 1) > userLevelFrame &&
        _currentStationIndex > user.completedStationsCount;

    // Dynamic counts from categories or fallback lore
    int skillSessionsCount = 0;
    int mediaSessionsCount = 0;
    for (var entry in _classCategories.entries) {
      if (entry.key.contains('مهارت')) {
        skillSessionsCount += entry.value.length;
      } else if (entry.key.contains('رسانه')) {
        mediaSessionsCount += entry.value.length;
      }
    }

    final String skillText = skillSessionsCount > 0 ? '${skillSessionsCount.toPersian()} جلسه' : (lore['skillSessions'] ?? '۲ جلسه');
    final String mediaText = mediaSessionsCount > 0 ? '${mediaSessionsCount.toPersian()} جلسه' : (lore['mediaSessions'] ?? '۴ جلسه');
    final String animText = _allClips.isNotEmpty ? '${_allClips.length.toPersian()} قسمت' : (lore['animationCount'] ?? '۲ قسمت');
    final String stayText = lore['stayDuration'] ?? '۱۰ روز';

    final String currentClipTitle = _allClips.isNotEmpty && _currentClipIndex < _allClips.length
        ? (_allClips[_currentClipIndex]['title'] ?? lore['clipTitle'] ?? 'انیمیشن منزلگاه')
        : (lore['clipTitle'] ?? 'انیمیشن کاروانسرای غبارگرفته (منزلگاه ۱)');

    final Widget scrollableContent = SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 2. Horizontal Station Selection & Progress Track Header
          StationProgressStepper(
            currentStationIndex: _currentStationIndex,
            totalNodes: totalStationNodes,
            userLevelFrame: userLevelFrame,
            completedStationsCount: user.completedStationsCount,
            title: lore['fullTitle'],
            onStationSelected: _switchStation,
          ),

          const SizedBox(height: 14),

          if (isLocked)
            // Locked Station State
            _buildLockedStationCard()
          else ...[
            // 3. Station Header: Description on Left & Station Image Box on Right
            _buildStationLoreHeader(lore),

            const SizedBox(height: 18),

            // 4. Class Information & Statistics Strip
            _buildStatsStrip(
              skillText: skillText,
              mediaText: mediaText,
              animText: animText,
              stayText: stayText,
            ),

            const SizedBox(height: 20),

            // 5. Animation / Video Clip Preview with Full Bleed Swipeable Carousel
            _buildAnimationCarouselSection(currentClipTitle),

            const SizedBox(height: 22),

            // 6. Action Buttons
            _buildActionButtonsRow(),

            const SizedBox(height: 24),
          ],
        ],
      ),
    );

    if (widget.isEmbeddedInMain) {
      return scrollableContent;
    }

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 1,
      onBackTap: _handleBackAction,
      body: scrollableContent,
    );
  }

  /// Locked Station State Card
  Widget _buildLockedStationCard() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 30, horizontal: 10),
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF28274A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF3E3B68), width: 1.2),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(
            'assets/svg_icons/lock02.svg',
            width: 48,
            height: 48,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 16),
          const Text(
            'این منزلگاه هنوز باز نشده است.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'جهت دسترسی به محتوا و کلاس‌های این منزلگاه، ابتدا مراحل و چالش‌های منزلگاه‌های قبلی را تکمیل نمایید.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFB5B3C8),
              fontSize: 12,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }



  /// 3. Station Lore Header: Text on Left & Station Image Box on Right (No shadow, no bottom text, Home gradient border)
  Widget _buildStationLoreHeader(Map<String, String> lore) {
    const double cardWidth = 105.0;
    const double cardHeight = 138.0;
    final String stationImage = _station?.imageUrl ?? '';
    final bool hasValidImg = stationImage.isNotEmpty && stationImage.startsWith('http') && !stationImage.contains('placeholder');
    final String ordinalTitle = lore['ordinalTitle'] ?? 'منزلگاه اول';
    final String fullDescription = lore['desc'] ?? '';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Right in RTL: Station Image Card (Home Screen style, no shadow, no bottom info text)
          Container(
            width: cardWidth,
            height: cardHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                stops: [0.0, 0.5, 1.0],
                colors: [
                  Color(0xFF3A3A6A),
                  Color(0xFF9292E2),
                  Color(0xFF3A3A6A),
                ],
              ),
            ),
            padding: const EdgeInsets.all(1.2), // Gradient border stroke
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14.8),
                color: const Color(0xFF2E2E50),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14.8),
                child: hasValidImg
                    ? CachedNetworkImage(
                        imageUrl: ApiConstants.resolveImageUrl(stationImage),
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          color: const Color(0xFF2E2E50),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/svg_icons/imagenot01.svg',
                            width: 40,
                            height: 40,
                            fit: BoxFit.contain,
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          color: const Color(0xFF2E2E50),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/svg_icons/imagenot01.svg',
                            width: 40,
                            height: 40,
                            fit: BoxFit.contain,
                          ),
                        ),
                      )
                    : Center(
                        child: SvgPicture.asset(
                          'assets/svg_icons/imagenot01.svg',
                          width: 40,
                          height: 40,
                          fit: BoxFit.contain,
                        ),
                      ),
              ),
            ),
          ),

          const SizedBox(width: 14),

          // 2. Left in RTL: Title & Description Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                // Title (Smaller font size ~17.5 as requested)
                Text(
                  ordinalTitle,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17.5,
                    fontWeight: FontWeight.w800,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 4),

                // Description with 6-line detection
                LayoutBuilder(
                  builder: (context, constraints) {
                    final textSpan = TextSpan(
                      text: fullDescription,
                      style: const TextStyle(
                        color: Color(0xFFD3D0E3),
                        fontSize: 10.5,
                        height: 1.38,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    );
                    final textPainter = TextPainter(
                      text: textSpan,
                      textDirection: TextDirection.rtl,
                      maxLines: 6,
                    )..layout(maxWidth: constraints.maxWidth);

                    final bool exceeds6Lines = textPainter.didExceedMaxLines;

                    if (_isDescriptionExpanded) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullDescription,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Color(0xFFD3D0E3),
                              fontSize: 10.5,
                              height: 1.38,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                          const SizedBox(height: 4),
                          GestureDetector(
                            onTap: () => setState(() => _isDescriptionExpanded = false),
                            child: const Text(
                              'بستن (کمتر)',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                color: Color(0xFFFFD574),
                                fontSize: 10.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),
                        ],
                      );
                    }

                    if (!exceeds6Lines) {
                      return Text(
                        fullDescription,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Color(0xFFD3D0E3),
                          fontSize: 10.5,
                          height: 1.38,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      );
                    }

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullDescription,
                          textAlign: TextAlign.right,
                          maxLines: 6,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFFD3D0E3),
                            fontSize: 10.5,
                            height: 1.38,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                        const SizedBox(height: 2),
                        GestureDetector(
                          onTap: () => setState(() => _isDescriptionExpanded = true),
                          child: const Text(
                            'بیشتر...',
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              color: Color(0xFFF4DCC5),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 4. Class Information & Statistics Strip (Right-aligned, 2 lines on tap)
  Widget _buildStatsStrip({
    required String skillText,
    required String mediaText,
    required String animText,
    required String stayText,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem('کلاس مهارتی', skillText),
            _buildVerticalDivider(),
            _buildStatItem('کلاس رسانه‌ای', mediaText),
            _buildVerticalDivider(),
            _buildStatItem('انیمیشن', animText),
            _buildVerticalDivider(),
            _buildStatItem('زمان اقامت', stayText),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String title, String subtitle) {
    final bool isExpanded = _expandedStatKeys.contains(title);

    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            if (_expandedStatKeys.contains(title)) {
              _expandedStatKeys.remove(title);
            } else {
              _expandedStatKeys.add(title);
            }
          });
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 2.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                textAlign: TextAlign.right,
                maxLines: isExpanded ? 2 : 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFFB3B0C7),
                  fontSize: 10.5,
                  fontWeight: FontWeight.normal,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(
      width: 1,
      height: 28,
      color: const Color(0xFF534E7E).withValues(alpha: 0.7),
    );
  }

  /// 5. Animation / Video Clip Preview with Swipeable PageView & Bottom-Left Navigation Buttons
  Widget _buildAnimationCarouselSection(String clipTitle) {
    final bool hasMultipleClips = _allClips.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Heading
        const Text(
          'انیمیشن هایی که باید ببینید',
          textAlign: TextAlign.right,
          style: TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
        const SizedBox(height: 10),

        // Video Preview Box with Swipeable PageView strictly 16:9
        AspectRatio(
          aspectRatio: 16 / 9,
          child: PageView.builder(
            clipBehavior: Clip.none,
            controller: _videoPageController,
            itemCount: _allClips.isNotEmpty ? _allClips.length : 1,
            onPageChanged: (idx) {
              setState(() {
                _currentClipIndex = idx;
              });
            },
            itemBuilder: (context, index) {
              final clip = _allClips.isNotEmpty && index < _allClips.length ? _allClips[index] : null;
              final String videoUrl = (clip != null && clip['videoUrl'] != null && clip['videoUrl'].toString().trim().isNotEmpty)
                  ? clip['videoUrl'].toString().trim()
                  : 'https://www.aparat.com/v/dbjk750';
              final String title = clip?['title']?.toString() ?? clipTitle;
              final String? poster = clip?['thumbnail']?.toString() ?? clip?['coverImageUrl']?.toString();

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4.0),
                child: NopaInlineVideoPlayer(
                  key: ValueKey('clip_${_currentStationIndex}_$index'),
                  videoUrl: videoUrl,
                  title: title,
                  coverImageUrl: poster,
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 8),

        // Video Caption (Right-aligned in RTL) + Prev/Next Buttons (Left corner in RTL)
        Directionality(
          textDirection: TextDirection.rtl,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Right: Caption text
              Expanded(
                child: Text(
                  clipTitle,
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF9D99B8),
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ),

              // Left in RTL: Thin Brown-Stroked Next & Prev Video Buttons (Swapped)
              if (hasMultipleClips)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 1. Next Button (On right in RTL: moves to next clip)
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _currentClipIndex < _allClips.length - 1
                            ? () {
                                _videoPageController.nextPage(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                );
                              }
                            : null,
                        borderRadius: BorderRadius.circular(15),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: Colors.transparent,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _currentClipIndex < _allClips.length - 1
                                  ? const Color(0xFFC09268)
                                  : const Color(0xFFC09268).withValues(alpha: 0.3),
                              width: 1.0,
                            ),
                          ),
                          child: Icon(
                            Icons.chevron_left_rounded,
                            color: _currentClipIndex < _allClips.length - 1
                                ? const Color(0xFFDEB58A)
                                : const Color(0xFFDEB58A).withValues(alpha: 0.3),
                            size: 19,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),

                    // 2. Previous Button (On left in RTL: moves to previous clip)
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _currentClipIndex > 0
                            ? () {
                                _videoPageController.previousPage(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                );
                              }
                            : null,
                        borderRadius: BorderRadius.circular(15),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: Colors.transparent,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _currentClipIndex > 0
                                  ? const Color(0xFFC09268)
                                  : const Color(0xFFC09268).withValues(alpha: 0.3),
                              width: 1.0,
                            ),
                          ),
                          child: Icon(
                            Icons.chevron_right_rounded,
                            color: _currentClipIndex > 0
                                ? const Color(0xFFDEB58A)
                                : const Color(0xFFDEB58A).withValues(alpha: 0.3),
                            size: 19,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// 6. Action Buttons Styled with NOPA Gradient Colors and Single-Line Fit
  Widget _buildActionButtonsRow() {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        children: [
          // 1. ورود به کلاس‌ها (ادغام مهارتی و رسانه‌ای)
          Expanded(
            flex: 3,
            child: _buildActionButton(
              title: 'ورود به کلاس‌ها',
              onTap: () => _navigateToClass('مهارت'),
            ),
          ),
          const SizedBox(width: 10),

          // 2. ارتباط با راهبر
          Expanded(
            flex: 2,
            child: _buildActionButton(
              title: 'ارتباط با راهبر',
              onTap: _contactMentor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required String title,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2835),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: const Color(0xFFC09268).withValues(alpha: 0.85),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFF4DCC5),
              fontSize: 10.5,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      ),
    );
  }
}


typedef Class1Screen = StudentClass1Screen;
