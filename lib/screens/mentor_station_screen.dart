import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../core/constants/api_constants.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../widgets/station_progress_stepper.dart';
import '../widgets/nopa_inline_video_player.dart';

class MentorStationScreen extends StatefulWidget {
  const MentorStationScreen({super.key});

  @override
  State<MentorStationScreen> createState() => _MentorStationScreenState();
}

enum _ReportTab { skillClass, mediaClass, quizzes }

class _MentorStationScreenState extends State<MentorStationScreen> {
  int _selectedStationIndex = 0;
  bool _isDescriptionExpanded = false;
  _ReportTab _selectedTab = _ReportTab.skillClass;
  final Set<String> _expandedMemberIds = {};
  final Set<String> _expandedStatKeys = {};
  bool _isLoading = true;
  int _currentClipIndex = 0;
  final PageController _videoPageController = PageController();

  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _members = [];

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

  @override
  void initState() {
    super.initState();
    _fetchMentorStationData();
  }

  @override
  void dispose() {
    _videoPageController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _currentStationClips {
    final List<Map<String, dynamic>> clips = [];
    if (_stations.isNotEmpty && _selectedStationIndex < _stations.length) {
      final station = _stations[_selectedStationIndex];
      final categories = station['categories'] as List? ?? [];
      for (final cat in categories) {
        if (cat is Map) {
          final sessions = (cat['sessions'] as List?)?.map((s) => s as Map<String, dynamic>).toList() ?? [];
          for (final sess in sessions) {
            final sClips = (sess['videoClips'] as List?)?.map((c) => c as Map<String, dynamic>).toList() ?? [];
            clips.addAll(sClips);
          }
        }
      }
    }
    if (clips.isEmpty) {
      final safeIndex = _selectedStationIndex.clamp(0, 5);
      final lore = _stationLore[safeIndex] ?? _stationLore[0]!;
      clips.add({
        'id': 'clip_$safeIndex',
        'title': lore['clipTitle'] ?? 'انیمیشن منزلگاه',
        'videoUrl': 'https://www.aparat.com/v/dbjk750',
      });
    }
    return clips;
  }

  Future<void> _fetchMentorStationData() async {
    try {
      final data = await HttpApiService().getMentorCaravanProgress();
      if (data != null && mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(data['stations'] ?? []);
          _members = List<Map<String, dynamic>>.from(data['members'] ?? []);
          _isLoading = false;
        });
        if (_members.isNotEmpty && _expandedMemberIds.isEmpty) {
          _expandedMemberIds.add(_members.first['id']?.toString() ?? '1');
        }
        return;
      }
    } catch (e) {
      debugPrint('Error loading mentor station data: $e');
    }

    // Fallback if offline or empty
    if (mounted) {
      setState(() {
        _isLoading = false;
        _stations = _defaultStations();
        _members = _defaultMembers();
        if (_members.isNotEmpty && _expandedMemberIds.isEmpty) {
          _expandedMemberIds.add(_members.first['id']?.toString() ?? '1');
        }
      });
    }
  }

  List<Map<String, dynamic>> _defaultStations() {
    return [
      {
        'id': 'st_0',
        'title': 'منزلگاه اول',
        'description':
            'اینجا منزلگاه اول، جایی در مناطق حاشیه‌ای صحرای فراموشی است. کاروانسرای غبارگرفته‌ای که اکنون در آن اقامت گزیده‌ایم، همیشه مسافران تازه‌کار را غافلگیر می‌کند. دیوارهای اینجا همه از آیینه‌هایی ساخته شده‌اند که می‌توانند چیزی فراتر از ظاهر را نشان دهند. عمق فکر و علایق و آرزوهای ما. پیر آیینه‌گر، مرشد و استادی است که در این منزلگاه سکونت دارد. همه‌ی این آیینه‌های خارق‌العاده، به دست او ساخته شده‌اند...',
        'skillSessions': [
          {'title': 'جلسه اول', 'totalParts': 5},
          {'title': 'جلسه دوم', 'totalParts': 5},
          {'title': 'جلسه سوم', 'totalParts': 5},
        ],
        'mediaSessions': [
          {'title': 'جلسه اول', 'totalParts': 4},
          {'title': 'جلسه دوم', 'totalParts': 4},
          {'title': 'جلسه سوم', 'totalParts': 4},
        ],
        'quizzes': [
          {'title': 'آزمون مقدماتی مهارت‌ها', 'totalQuestions': 10},
          {'title': 'آزمون سواد رسانه‌ای', 'totalQuestions': 10},
          {'title': 'آزمون جامع منزلگاه اول', 'totalQuestions': 20},
        ],
        'stayDays': 'ده روز',
        'animationEpisodes': 'دو قسمت',
      },
      {
        'id': 'st_1',
        'title': 'منزلگاه دوم',
        'description':
            'منزلگاه دوم، دروازه ورود به سرزمین حکمت و مهارت‌آموزی است. در این ایستگاه، کاروانیان با مفاهیم عمیق‌تر ارتباط و حل مسئله آشنا می‌شوند.',
        'skillSessions': [
          {'title': 'جلسه اول', 'totalParts': 5},
          {'title': 'جلسه دوم', 'totalParts': 5},
        ],
        'mediaSessions': [
          {'title': 'جلسه اول', 'totalParts': 3},
          {'title': 'جلسه دوم', 'totalParts': 3},
        ],
        'quizzes': [
          {'title': 'آزمون مهارت‌های ارتباطی', 'totalQuestions': 15},
        ],
        'stayDays': 'هشت روز',
        'animationEpisodes': 'یک قسمت',
      },
      {
        'id': 'st_2',
        'title': 'منزلگاه سوم',
        'description':
            'منزلگاه سوم، وادی آزمایش و تفکر خلاق است که در آن کاروانیان گام‌های عملی در پروژه‌های تیمی برمی‌دارند.',
        'skillSessions': [
          {'title': 'جلسه اول', 'totalParts': 4},
        ],
        'mediaSessions': [
          {'title': 'جلسه اول', 'totalParts': 4},
        ],
        'quizzes': [
          {'title': 'آزمون تفکر خلاق', 'totalQuestions': 10},
        ],
        'stayDays': 'هفت روز',
        'animationEpisodes': 'دو قسمت',
      },
      {
        'id': 'st_3',
        'title': 'منزلگاه چهارم',
        'description': 'منزلگاه چهارم، اوج یادگیری و مهارت‌افزایی کاروانیان است.',
        'stayDays': 'ده روز',
        'animationEpisodes': 'سه قسمت',
      },
      {
        'id': 'st_4',
        'title': 'منزلگاه پنجم',
        'description': 'منزلگاه پنجم، تثبیت آموخته‌ها و آمادگی برای ایستگاه نهایی.',
        'stayDays': 'پنج روز',
        'animationEpisodes': 'یک قسمت',
      },
      {
        'id': 'st_5',
        'title': 'منزلگاه ششم',
        'description': 'منزلگاه پیروزی و پایان سفر قهرمانی.',
        'stayDays': 'سه روز',
        'animationEpisodes': 'یک قسمت',
      },
    ];
  }

  List<Map<String, dynamic>> _defaultMembers() {
    return [
      {
        'id': 'mem_1',
        'name': 'محمد حسینی',
        'avatarUrl': '',
        'phoneNumber': '09121111111',
        'skillProgress': [5, 2, 0], // parts watched for session 1, 2, 3
        'mediaProgress': [4, 1, 0],
        'quizScores': ['۲۰ از ۲۰', '۱۶ از ۲۰', 'در انتظار آزمون'],
      },
      {
        'id': 'mem_2',
        'name': 'علی رضایی',
        'avatarUrl': '',
        'phoneNumber': '09122222222',
        'skillProgress': [5, 5, 3],
        'mediaProgress': [4, 4, 2],
        'quizScores': ['۱۹ از ۲۰', '۱۸ از ۲۰', '۱۷ از ۲۰'],
      },
      {
        'id': 'mem_3',
        'name': 'حسین موسوی',
        'avatarUrl': '',
        'phoneNumber': '09123333333',
        'skillProgress': [3, 0, 0],
        'mediaProgress': [2, 0, 0],
        'quizScores': ['۱۴ از ۲۰', 'در انتظار آزمون', 'در انتظار آزمون'],
      },
    ];
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final user = repository.currentUser;
    final int userLevelFrame = user.levelFrame < 1 ? 1 : user.levelFrame;
    final int completedCount = user.completedStationsCount;

    final totalStationNodes = _stations.isNotEmpty ? _stations.length : 6;
    final int safeIndex = _selectedStationIndex.clamp(0, 5);
    final lore = _stationLore[safeIndex] ?? _stationLore[0]!;
    final currentStationData = _stations.isNotEmpty && _selectedStationIndex < _stations.length
        ? _stations[_selectedStationIndex]
        : (_stations.isNotEmpty ? _stations.first : _defaultStations().first);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _fetchMentorStationData,
        color: const Color(0xFFDFB690),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),

              // 1. Station Progress Stepper (Matching User Panel / MapScreen rules)
              StationProgressStepper(
                currentStationIndex: _selectedStationIndex,
                totalNodes: totalStationNodes,
                userLevelFrame: userLevelFrame,
                completedStationsCount: completedCount,
                title: lore['fullTitle'] ?? currentStationData['title'] ?? 'منزلگاه اول',
                onStationSelected: (index) {
                  setState(() {
                    _selectedStationIndex = index;
                    _isDescriptionExpanded = false;
                    _currentClipIndex = 0;
                  });
                  if (_videoPageController.hasClients) {
                    _videoPageController.jumpToPage(0);
                  }
                },
              ),

              const SizedBox(height: 14),

              // 2. Station Lore Header: Description on Left & Station Image Box on Right
              _buildStationLoreHeader(lore, currentStationData),

              const SizedBox(height: 18),

              // 3. Class Information & Statistics Strip
              _buildStatsStrip(
                skillText: currentStationData['skillSessions'] != null
                    ? '${(currentStationData['skillSessions'] as List).length} جلسه'
                    : (lore['skillSessions'] ?? '۳ جلسه'),
                mediaText: currentStationData['mediaSessions'] != null
                    ? '${(currentStationData['mediaSessions'] as List).length} جلسه'
                    : (lore['mediaSessions'] ?? '۳ جلسه'),
                animText: currentStationData['animationEpisodes'] ?? (lore['animationCount'] ?? '۲ قسمت'),
                stayText: currentStationData['stayDays'] ?? (lore['stayDuration'] ?? '۱۰ روز'),
              ),

              const SizedBox(height: 20),

              // 4. Animation Carousel Section (Matching User Panel in Class1Screen)
              _buildAnimationCarouselSection(lore['clipTitle'] ?? 'انیمیشن منزلگاه'),

              const SizedBox(height: 28),

              // 5. Educational Report Header ("گزارش آموزشی اعضا")
              _buildEducationalReportSectionHeader(),

              const SizedBox(height: 16),

              // 6. Pill Tabs styled like login screen mode switcher (stroke gradient & dark surface gradient)
              _buildPillTabs(),

              const SizedBox(height: 10),

              // 7. Subtitle
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'اطلاعات آموزشی هر فرد در این منزلگاه برای شما نمایش داده میشود',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                    fontSize: 12.5,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // 8. Caravan Members Accordion Cards List
              _buildMembersList(currentStationData),

              const SizedBox(height: 50),
            ],
          ),
        ),
      ),
    );
  }

  /// Station Lore Header: Text on Left & Station Image Box on Right (Matching Class1 Screen)
  Widget _buildStationLoreHeader(Map<String, String> lore, Map<String, dynamic> station) {
    const double cardWidth = 105.0;
    const double cardHeight = 138.0;
    final String stationImage = station['imageUrl']?.toString() ?? '';
    final bool hasValidImg = stationImage.isNotEmpty && stationImage.startsWith('http') && !stationImage.contains('placeholder');
    final String ordinalTitle = lore['ordinalTitle'] ?? station['title'] ?? 'منزلگاه اول';
    final String fullDescription = lore['desc'] ?? station['description'] ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Right in RTL: Station Image Card (Class 1 style)
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
              padding: const EdgeInsets.all(1.2),
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
                  // Title
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
      ),
    );
  }

  /// Class Information & Statistics Strip (Matching Class1 Screen)
  Widget _buildStatsStrip({
    required String skillText,
    required String mediaText,
    required String animText,
    required String stayText,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
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
      height: 24,
      width: 1,
      color: const Color(0xFF4A4476).withValues(alpha: 0.6),
    );
  }

  /// Animation / Video Clip Preview with Swipeable PageView (Matching Class1 Screen)
  Widget _buildAnimationCarouselSection(String clipTitle) {
    final clips = _currentStationClips;
    final bool hasMultipleClips = clips.length > 1;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
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
              itemCount: clips.isNotEmpty ? clips.length : 1,
              onPageChanged: (idx) {
                setState(() {
                  _currentClipIndex = idx;
                });
              },
              itemBuilder: (context, index) {
                final clip = clips.isNotEmpty && index < clips.length ? clips[index] : null;
                final String videoUrl = (clip != null && clip['videoUrl'] != null && clip['videoUrl'].toString().trim().isNotEmpty)
                    ? clip['videoUrl'].toString().trim()
                    : 'https://www.aparat.com/v/dbjk750';
                final String title = clip?['title']?.toString() ?? clipTitle;
                final String? poster = clip?['thumbnail']?.toString() ?? clip?['coverImageUrl']?.toString();

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                  child: NopaInlineVideoPlayer(
                    key: ValueKey('mentor_clip_${_selectedStationIndex}_$index'),
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
                      // Next Button (On right in RTL: moves to next clip)
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: _currentClipIndex < clips.length - 1
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
                                color: _currentClipIndex < clips.length - 1
                                    ? const Color(0xFFC09268)
                                    : const Color(0xFFC09268).withValues(alpha: 0.3),
                                width: 1.0,
                              ),
                            ),
                            child: Icon(
                              Icons.chevron_left_rounded,
                              color: _currentClipIndex < clips.length - 1
                                  ? const Color(0xFFDEB58A)
                                  : const Color(0xFFDEB58A).withValues(alpha: 0.3),
                              size: 19,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),

                      // Previous Button (On left in RTL: moves to previous clip)
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
      ),
    );
  }

  /// Big Centered Title: "گزارش آموزشی اعضا"
  Widget _buildEducationalReportSectionHeader() {
    return const Center(
      child: Text(
        'گزارش آموزشی اعضا',
        style: TextStyle(
          fontFamily: AppTheme.fontFamily,
          fontFamilyFallback: AppTheme.fontFamilyFallback,
          fontSize: 22,
          fontWeight: FontWeight.w900,
          color: Colors.white,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  /// Pill Tabs styled like login screen mode switcher (strokeGradient, darkSurfaceGradient, accentGradient)
  Widget _buildPillTabs() {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.strokeGradient,
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(AppColors.borderWidth),
        child: Container(
          decoration: BoxDecoration(
            gradient: AppColors.darkSurfaceGradient,
            borderRadius: BorderRadius.circular(9),
          ),
          padding: const EdgeInsets.all(3),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildTabButton('کلاس مهارتی', _selectedTab == _ReportTab.skillClass, () {
                  setState(() {
                    _selectedTab = _ReportTab.skillClass;
                  });
                }),
                const SizedBox(width: 4),
                _buildTabButton('کلاس رسانه ای', _selectedTab == _ReportTab.mediaClass, () {
                  setState(() {
                    _selectedTab = _ReportTab.mediaClass;
                  });
                }),
                const SizedBox(width: 4),
                _buildTabButton('آزمون ها', _selectedTab == _ReportTab.quizzes, () {
                  setState(() {
                    _selectedTab = _ReportTab.quizzes;
                  });
                }),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabButton(String title, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          gradient: isSelected ? AppColors.accentGradient : null,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF8E889D),
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ),
    );
  }

  /// Accordion Cards for each Member (مشابه باکس پیام‌ها)
  Widget _buildMembersList(Map<String, dynamic> station) {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(color: Color(0xFFDFB690)),
        ),
      );
    }

    if (_members.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'عضوی در این کاروان یافت نشد',
            style: TextStyle(
              fontFamily: AppTheme.fontFamily,
              color: Colors.white.withValues(alpha: 0.6),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _members.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final member = _members[index];
          final memberId = member['id']?.toString() ?? '$index';
          final isExpanded = _expandedMemberIds.contains(memberId);

          return _buildMemberCard(member, memberId, isExpanded, station);
        },
      ),
    );
  }

  Widget _buildMemberCard(
    Map<String, dynamic> member,
    String memberId,
    bool isExpanded,
    Map<String, dynamic> station,
  ) {
    final name = member['name'] ?? 'عضو کاروان';
    final avatarUrl = member['avatarUrl']?.toString() ?? '';

    return Container(
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
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border matching Class2
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Member Header (Capsule gradient surface matching Class2)
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedMemberIds.remove(memberId);
                  } else {
                    _expandedMemberIds.add(memberId);
                  }
                });
              },
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.vertical(top: Radius.circular(14.8))
                      : BorderRadius.circular(14.8),
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0.0, 0.53, 1.0],
                    colors: [
                      Color(0xFF3D3C67),
                      Color(0xFF36345C),
                      Color(0xFF333359),
                    ],
                  ),
                  border: isExpanded
                      ? const Border(
                          bottom: BorderSide(
                            color: Color(0xFF282542),
                            width: 1.0,
                          ),
                        )
                      : null,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    // Left side: Chevron Arrow + "پیگیری" Button
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: const Color(0xFFDDD9EE),
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        // "پیگیری" Follow-up Button
                        GestureDetector(
                          onTap: () => _openFollowUpDialog(member),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFF7B75AF).withValues(alpha: 0.7),
                                width: 1,
                              ),
                            ),
                            child: const Text(
                              'پیگیری',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFDCD7F5),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const Spacer(),

                    // Right side: Member Name + Avatar (RTL)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF534C82),
                            border: Border.all(
                              color: const Color(0xFF837CB7).withValues(alpha: 0.5),
                              width: 1,
                            ),
                          ),
                          child: ClipOval(
                            child: avatarUrl.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: avatarUrl,
                                    fit: BoxFit.cover,
                                    placeholder: (ctx, url) => const Icon(
                                      Icons.person,
                                      color: Colors.white70,
                                      size: 20,
                                    ),
                                    errorWidget: (ctx, url, error) => const Icon(
                                      Icons.person,
                                      color: Colors.white70,
                                      size: 20,
                                    ),
                                  )
                               : const Icon(
                                    Icons.person_rounded,
                                    color: Color(0xFFEDE9F6),
                                    size: 20,
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Member Expanded Content (Matching Class2 body background)
            if (isExpanded)
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF1B192A),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: _buildMemberProgressContent(member, station),
              ),
          ],
        ),
      ),
    );
  }

  /// Builds progress rows for either Skill Class, Media Class, or Quizzes
  Widget _buildMemberProgressContent(
    Map<String, dynamic> member,
    Map<String, dynamic> station,
  ) {
    if (_selectedTab == _ReportTab.quizzes) {
      return _buildQuizzesProgress(member, station);
    }

    final isSkill = _selectedTab == _ReportTab.skillClass;
    final sessionList = isSkill
        ? (station['skillSessions'] as List? ?? [
            {'title': 'جلسه اول', 'totalParts': 5},
            {'title': 'جلسه دوم', 'totalParts': 5},
            {'title': 'جلسه سوم', 'totalParts': 5},
          ])
        : (station['mediaSessions'] as List? ?? [
            {'title': 'جلسه اول', 'totalParts': 4},
            {'title': 'جلسه دوم', 'totalParts': 4},
            {'title': 'جلسه سوم', 'totalParts': 4},
          ]);

    final List<dynamic> memberWatched = isSkill
        ? (member['skillProgress'] as List? ?? [5, 2, 0])
        : (member['mediaProgress'] as List? ?? [4, 1, 0]);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: List.generate(sessionList.length, (idx) {
          final session = sessionList[idx];
          final title = session['title'] ?? 'جلسه ${idx + 1}';
          final totalParts = session['totalParts'] ?? 5;
          final watchedParts = idx < memberWatched.length ? (memberWatched[idx] as int? ?? 0) : 0;

          // Status icon: Green check if completed, orange pause if in-progress, play if 0
          Widget statusIcon;
          if (watchedParts >= totalParts && totalParts > 0) {
            statusIcon = Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF22C55E),
              ),
              child: const Icon(Icons.check_rounded, color: Colors.white, size: 15),
            );
          } else if (watchedParts > 0) {
            statusIcon = Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
              ),
              child: const Icon(Icons.pause_rounded, color: Color(0xFFF59E0B), size: 14),
            );
          } else {
            statusIcon = Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
                border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.2),
              ),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white70, size: 15),
            );
          }

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                // Right: Status Icon + Session Title
                statusIcon,
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFEDE9F6),
                    ),
                  ),
                ),

                // Center: Total Parts
                Expanded(
                  flex: 3,
                  child: Text(
                    'کل پارت ها: $totalParts',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 12.5,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                ),

                // Left: Watched Parts
                Expanded(
                  flex: 2,
                  child: Text(
                    'دیده شده: $watchedParts',
                    textAlign: TextAlign.left,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: watchedParts >= totalParts
                          ? const Color(0xFF4ADE80)
                          : (watchedParts > 0
                              ? const Color(0xFFFBBF24)
                              : Colors.white.withValues(alpha: 0.45)),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  /// Builds progress rows for Quizzes / Tests
  Widget _buildQuizzesProgress(Map<String, dynamic> member, Map<String, dynamic> station) {
    final quizList = station['quizzes'] as List? ?? [
      {'title': 'آزمون مقدماتی مهارت‌ها'},
      {'title': 'آزمون سواد رسانه‌ای'},
      {'title': 'آزمون جامع منزلگاه'},
    ];

    final quizScores = member['quizScores'] as List? ?? ['۲۰ از ۲۰', '۱۶ از ۲۰', 'در انتظار آزمون'];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: List.generate(quizList.length, (idx) {
          final quiz = quizList[idx];
          final title = quiz['title'] ?? 'آزمون شماره ${idx + 1}';
          final score = idx < quizScores.length ? quizScores[idx].toString() : 'در انتظار آزمون';
          final isPending = score.contains('انتظار');

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                // Icon
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isPending
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.2)
                        : const Color(0xFF22C55E),
                    border: isPending
                        ? Border.all(color: const Color(0xFFF59E0B), width: 1.2)
                        : null,
                  ),
                  child: Icon(
                    isPending ? Icons.access_time_rounded : Icons.check_rounded,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
                const SizedBox(width: 8),

                // Quiz Title
                Expanded(
                  flex: 4,
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFEDE9F6),
                    ),
                  ),
                ),

                // Score / Status
                Expanded(
                  flex: 3,
                  child: Text(
                    score,
                    textAlign: TextAlign.left,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: isPending
                          ? const Color(0xFFFBBF24)
                          : const Color(0xFF4ADE80),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  /// Follow-up modal sheet when clicking "پیگیری"
  void _openFollowUpDialog(Map<String, dynamic> member) {
    final name = member['name'] ?? 'عضو کاروان';
    final phone = member['phoneNumber'] ?? '';
    final controller = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetCtx) {
        return Container(
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(sheetCtx).viewInsets.bottom + 20,
          ),
          decoration: const BoxDecoration(
            color: Color(0xFF231F42),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(
              top: BorderSide(color: Color(0xFF6A649E), width: 1.2),
            ),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'پیگیری آموزشی: $name',
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'شماره تماس: $phone',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                  decoration: InputDecoration(
                    hintText: 'متن پیام یا یادداشت پیگیری برای این عضو را وارد کنید...',
                    hintStyle: TextStyle(
                      color: Colors.white.withValues(alpha: 0.4),
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                    ),
                    filled: true,
                    fillColor: const Color(0xFF17142F),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFF4C467A)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFDFB690)),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(sheetCtx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'پیام پیگیری برای $name ثبت شد.',
                          style: const TextStyle(fontFamily: AppTheme.fontFamily),
                        ),
                        backgroundColor: const Color(0xFF2E7D32),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFCD8449),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text(
                    'ارسال پیام و ثبت پیگیری',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
