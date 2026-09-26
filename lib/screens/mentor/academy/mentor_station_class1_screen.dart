import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/models/station.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/station_progress_stepper.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';
import 'package:nopa_app/screens/student/academy/student_class2_screen.dart';

class MentorStationClass1Screen extends StatefulWidget {
  const MentorStationClass1Screen({super.key});

  @override
  State<MentorStationClass1Screen> createState() => _MentorStationScreenState();
}

enum _ReportTab { skillClass, mediaClass, quizzes }

class _MentorStationScreenState extends State<MentorStationClass1Screen> {
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
      if (clips.isEmpty && station['animationUrl'] != null && station['animationUrl'].toString().isNotEmpty) {
        clips.add({
          'id': 'clip_${station['id']}',
          'title': station['animationTitle'] ?? 'انیمیشن معرفی منزلگاه',
          'videoUrl': station['animationUrl'],
        });
      }
    }
    if (clips.isEmpty) {
      clips.add({
        'id': 'clip_default',
        'title': 'انیمیشن منزلگاه',
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
                title: currentStationData['title'] ?? 'منزلگاه اول',
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
              _buildStationLoreHeader(currentStationData),

              const SizedBox(height: 18),

              // 3. Class Information & Statistics Strip
              _buildStatsStrip(
                skillText: currentStationData['skillSessions'] != null
                    ? '${(currentStationData['skillSessions'] as List).length} جلسه'
                    : '۲ جلسه',
                mediaText: currentStationData['mediaSessions'] != null
                    ? '${(currentStationData['mediaSessions'] as List).length} جلسه'
                    : '۴ جلسه',
                animText: currentStationData['animationEpisodes'] ?? '${_currentStationClips.length} قسمت',
                stayText: currentStationData['stayDuration'] ?? currentStationData['stayDays'] ?? '${(_selectedStationIndex * 3 + 5).toPersianDigits()} روز',
              ),

              const SizedBox(height: 12),

              // Enter Classes Button
              _buildEnterClassesButton(currentStationData),

              const SizedBox(height: 20),

              // 4. Animation Carousel Section (Matching User Panel in Class1Screen)
              _buildAnimationCarouselSection(currentStationData['animationTitle'] ?? 'انیمیشن منزلگاه'),

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
  Widget _buildStationLoreHeader(Map<String, dynamic> station) {
    const double cardWidth = 105.0;
    const double cardHeight = 138.0;
    final String stationImage = station['imageUrl']?.toString() ?? '';
    final bool hasValidImg = stationImage.isNotEmpty && stationImage.startsWith('http') && !stationImage.contains('placeholder');
    final String ordinalTitle = station['title'] ?? Station.getOrdinalName(_selectedStationIndex);
    final String fullDescription = station['description']?.toString() ?? 'توضیحات و محتوای آموزشی این منزلگاه در این بخش نمایش داده می‌شود.';

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

  /// Button to enter classes screen (styled compact with stroke gradient)
  Widget _buildEnterClassesButton(Map<String, dynamic> station) {
    return Center(
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const Class2Screen(),
              settings: RouteSettings(
                arguments: {
                  'stationIndex': _selectedStationIndex,
                  'stationData': station,
                },
              ),
            ),
          );
        },
        child: Container(
          decoration: BoxDecoration(
            gradient: AppColors.strokeGradient,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          padding: const EdgeInsets.all(AppColors.borderWidth),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            decoration: BoxDecoration(
              gradient: AppColors.darkSurfaceGradient,
              borderRadius: BorderRadius.circular(19),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(
                  Icons.menu_book_rounded,
                  color: Color(0xFFDFB690),
                  size: 16,
                ),
                SizedBox(width: 7),
                Text(
                  'ورود به صفحه کلاس‌ها',
                  style: TextStyle(
                    color: Color(0xFFEDE9F6),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                SizedBox(width: 4),
                Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: Color(0xFFDFB690),
                  size: 11,
                ),
              ],
            ),
          ),
        ),
      ),
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right Side in RTL: Avatar + Name (نوشته اسم و پروفایل در سمت راست)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 30,
                            height: 30,
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
                                        size: 17,
                                      ),
                                      errorWidget: (ctx, url, error) => const Icon(
                                        Icons.person,
                                        color: Colors.white70,
                                        size: 17,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.person_rounded,
                                      color: Color(0xFFEDE9F6),
                                      size: 17,
                                    ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            name,
                            style: const TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left Side in RTL: Follow-up Button + Chevron Arrow (دکمه پیگیری شبیه دکمه تکمیل در پیام‌ها)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () => _openFollowUpDialog(member),
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: AppColors.strokeGradient,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              padding: const EdgeInsets.all(AppColors.borderWidth),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                                decoration: BoxDecoration(
                                  gradient: AppColors.darkSurfaceGradient,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: const Text(
                                  'پیگیری',
                                  style: TextStyle(
                                    color: Color(0xFFC7B299),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            isExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: const Color(0xFFDDD9EE),
                            size: 20,
                          ),
                        ],
                      ),
                    ],
                  ),
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
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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

          // Status icon: Green check if completed, camel pause if in-progress, play if 0
          Widget statusIcon;
          if (watchedParts >= totalParts && totalParts > 0) {
            statusIcon = Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF22C55E),
              ),
              child: const Icon(Icons.check_rounded, color: Colors.white, size: 13),
            );
          } else if (watchedParts > 0) {
            statusIcon = Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFDFB690).withValues(alpha: 0.18),
                border: Border.all(color: const Color(0xFFDFB690), width: 1.2),
              ),
              child: const Icon(Icons.pause_rounded, color: Color(0xFFDFB690), size: 13),
            );
          } else {
            statusIcon = Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
                border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.0),
              ),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white70, size: 13),
            );
          }

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.5),
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
                      fontSize: 11.5,
                      fontWeight: FontWeight.normal,
                      color: Color(0xFFEDE9F6),
                    ),
                  ),
                ),

                // Center: Total Parts
                Expanded(
                  flex: 3,
                  child: Text(
                    'کل پارت‌ها: $totalParts',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 11,
                      fontWeight: FontWeight.normal,
                      color: Colors.white.withValues(alpha: 0.55),
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
                      fontSize: 11,
                      fontWeight: FontWeight.normal,
                      color: watchedParts >= totalParts
                          ? const Color(0xFF4ADE80)
                          : (watchedParts > 0
                              ? const Color(0xFFDFB690)
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
            padding: const EdgeInsets.symmetric(vertical: 4.5),
            child: Row(
              children: [
                // Icon: Check for completed, Pause for current in-progress, Play for not seen yet
                if (!isPending)
                  Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF22C55E),
                    ),
                    child: const Icon(Icons.check_rounded, color: Colors.white, size: 13),
                  )
                else if (idx == 0)
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFDFB690).withValues(alpha: 0.18),
                      border: Border.all(color: const Color(0xFFDFB690), width: 1.2),
                    ),
                    child: const Icon(Icons.pause_rounded, color: Color(0xFFDFB690), size: 13),
                  )
                else
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.08),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.0),
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white70, size: 13),
                  ),
                const SizedBox(width: 8),

                // Quiz Title
                Expanded(
                  flex: 4,
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 11.5,
                      fontWeight: FontWeight.normal,
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
                      fontSize: 11,
                      fontWeight: FontWeight.normal,
                      color: isPending
                          ? const Color(0xFFDFB690)
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

  Widget _buildDialogPillBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6.5),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: const Color(0xFF7A709E),
          width: 1.1,
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFDDD9EE),
          fontSize: 12,
          fontWeight: FontWeight.w500,
          fontFamily: AppTheme.fontFamily,
        ),
      ),
    );
  }

  Widget _buildDialogRow({required String label, required Widget content}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _buildDialogPillBadge(label),
        const SizedBox(width: 12),
        Expanded(child: content),
      ],
    );
  }

  /// Follow-up dialog for sending message to student (matching ContactUsDialog template and style)
  void _openFollowUpDialog(Map<String, dynamic> member) {
    final name = member['name']?.toString() ?? 'دانش‌آموز کاروان';
    final phone = member['phoneNumber']?.toString() ?? '';
    final controller = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
              decoration: BoxDecoration(
                color: const Color(0xFF2C2849),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 24,
                    spreadRadius: 2,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header: Message Icon on right (in RTL) and Centered Title
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        const Align(
                          alignment: Alignment.centerRight,
                          child: Icon(
                            Icons.chat_bubble_outline_rounded,
                            color: Color(0xFF9E9CD6),
                            size: 32,
                          ),
                        ),
                        const Text(
                          'پیام به دانش‌آموز',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),

                    // 1. Student Name
                    _buildDialogRow(
                      label: 'نام دانش‌آموز:',
                      content: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E1D38),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF7A709E), width: 1.1),
                        ),
                        child: Text(
                          name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                    ),

                    if (phone.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      // 2. Phone
                      _buildDialogRow(
                        label: 'شماره تماس:',
                        content: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1D38),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF7A709E), width: 1.1),
                          ),
                          child: Text(
                            phone,
                            textDirection: TextDirection.ltr,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Color(0xFFDDD9EE),
                              fontSize: 12.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 12),

                    // 3. Message Text input
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildDialogPillBadge('متن پیام:'),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1D38),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFF7A709E), width: 1.1),
                          ),
                          child: TextField(
                            controller: controller,
                            maxLines: 4,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            decoration: const InputDecoration(
                              hintText: 'متن پیام یا پیگیری آموزشی برای این عضو را بنویسید...',
                              hintStyle: TextStyle(
                                color: Color(0xFF7E789F),
                                fontSize: 12,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              contentPadding: EdgeInsets.all(12),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Bottom Buttons: ارسال پیام & لغو (matching ContactUsDialog)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // ارسال پیام (Right in RTL)
                        TextButton(
                          onPressed: () {
                            final text = controller.text.trim();
                            if (text.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('لطفاً متن پیام را وارد کنید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                  backgroundColor: Color(0xFFC2410C),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }
                            Navigator.pop(dialogCtx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('پیام برای $name با موفقیت ارسال شد.', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
                                backgroundColor: const Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          ),
                          child: const Text(
                            'ارسال پیام',
                            style: TextStyle(
                              color: Color(0xFF9E9CD6),
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),

                        // لغو (Left in RTL)
                        TextButton(
                          onPressed: () => Navigator.pop(dialogCtx),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          ),
                          child: const Text(
                            'لغو',
                            style: TextStyle(
                              color: Color(0xFF9E9CD6),
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}


typedef MentorStationScreen = MentorStationClass1Screen;
