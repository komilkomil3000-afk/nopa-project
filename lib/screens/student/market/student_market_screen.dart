import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';
import 'package:nopa_app/utils/constants.dart';

class StudentMarketScreen extends StatefulWidget {
  const StudentMarketScreen({super.key});

  @override
  State<StudentMarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<StudentMarketScreen> {
  // 5 Standard Market Rate Items matching screenshot
  final List<Map<String, dynamic>> _rateItems = const [
    {
      'title': 'نخ',
      'priceText': '500 زریک',
      'assetKey': 'نخ',
      'zarikCost': 500,
    },
    {
      'title': 'فرش',
      'priceText': '5 نخ',
      'assetKey': 'فرش',
      'zarikCost': 2500,
    },
    {
      'title': 'بیرق مسی',
      'priceText': '5 نخ',
      'assetKey': 'بیرق مسی',
      'zarikCost': 2500,
    },
    {
      'title': 'بیرق نقره ای',
      'priceText': '3 فرش',
      'assetKey': 'بیرق نقره ای',
      'zarikCost': 7500,
    },
    {
      'title': 'بیرق طلایی',
      'priceText': 'غیر قابل خرید',
      'assetKey': 'بیرق طلایی',
      'zarikCost': 22500,
    },
  ];

  // Selected asset index for "سرمایه های شما"
  int _selectedAssetIndex = 0;

  // Selected tab for "برترین ها (لیگ)" (0: برترین شرکت کننده ها, 1: برترین کاروان ها)
  int _selectedLeaderboardTab = 0;

  // Exchange calculator states
  String _sourceAsset = 'زریک';
  String _targetAsset = 'نخ';
  final TextEditingController _amountController = TextEditingController(text: '500');
  double _calculatedResult = 1.0;

  // Interactive button selection states (0: none, 1: submit active, 2: mentor active)
  int _activeActionButton = 1; // Default: 'ثبت درخواست' is active/colored

  final List<String> _availableAssets = ['زریک', 'نخ', 'فرش', 'بیرق مسی', 'بیرق نقره ای', 'بیرق طلایی'];

  // Mentor Market States
  int _selectedMentorMarketTab = 0; // 0: گزارش اعضا, 1: مبادلات
  final Set<String> _expandedMemberAssetIds = {'mem_1'};
  final Set<String> _expandedExchangeIds = {'ex_1'};

  List<Map<String, dynamic>> _mentorMembersAssets = [];
  List<Map<String, dynamic>> _mentorExchangeRequests = [];

  String _formatPersianDate(dynamic date) {
    if (date == null) {
      final nowJ = Jalali.now();
      return '${nowJ.year}/${nowJ.month.toString().padLeft(2, '0')}/${nowJ.day.toString().padLeft(2, '0')}'.toPersianDigits();
    }
    try {
      final dt = date is DateTime ? date : DateTime.tryParse(date.toString());
      if (dt != null) {
        final j = Jalali.fromDateTime(dt);
        return '${j.year}/${j.month.toString().padLeft(2, '0')}/${j.day.toString().padLeft(2, '0')}'.toPersianDigits();
      }
    } catch (_) {}
    return date.toString().toPersianDigits();
  }

  Future<void> _loadMarketData() async {
    try {
      final progressData = await HttpApiService().getMentorCaravanProgress();
      final exchangeData = await HttpApiService().getCaravanAssetConversions();

      if (mounted) {
        setState(() {
          if (progressData != null && progressData['members'] != null) {
            final list = List<Map<String, dynamic>>.from(progressData['members'] ?? []);
            if (list.isNotEmpty) {
              _mentorMembersAssets = list;
              if (_expandedMemberAssetIds.isEmpty) {
                _expandedMemberAssetIds.add(list.first['id']?.toString() ?? '1');
              }
            }
          }
          if (exchangeData.isNotEmpty) {
            _mentorExchangeRequests = exchangeData.map((req) {
              final student = req['user'] as Map<String, dynamic>?;
              final String title = req['note']?.toString() ?? 'درخواست تبدیل دارایی';
              final date = _formatPersianDate(req['createdAt']);
              return {
                'id': req['id']?.toString() ?? '',
                'studentName': student?['name']?.toString() ?? 'دانش‌آموز',
                'studentId': req['requestedBy']?.toString() ?? '',
                'title': title,
                'date': date,
                'status': req['status']?.toString() ?? 'pending',
              };
            }).toList();
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading market data: $e');
    }
  }

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    _recalculateExchange();
    _loadMarketData();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  double _getAssetValueInZarik(String asset) {
    switch (asset) {
      case 'زریک':
        return 1.0;
      case 'نخ':
        return 500.0;
      case 'فرش':
      case 'بیرق مسی':
        return 2500.0; // 5 Nakh * 500
      case 'بیرق نقره ای':
      case 'بیرق نقره‌ای':
        return 7500.0; // 3 Carpet * 2500
      case 'بیرق طلایی':
        return 22500.0; // 3 Silver * 7500
      default:
        return 1.0;
    }
  }

  void _recalculateExchange() {
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final double sourceVal = _getAssetValueInZarik(_sourceAsset);
    final double targetVal = _getAssetValueInZarik(_targetAsset);

    setState(() {
      if (targetVal > 0 && amount > 0) {
        _calculatedResult = ((amount * sourceVal) / targetVal);
      } else {
        _calculatedResult = 0.0;
      }
    });
  }

  void _submitExchangeRequest() {
    setState(() => _activeActionButton = 1);
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    if (amount <= 0 || _calculatedResult <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً مقدار معتبری برای مبادله وارد کنید.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final String amountStr = amount % 1 == 0 ? amount.toInt().toString() : amount.toString();
    final String resultStr = _calculatedResult % 1 == 0 ? _calculatedResult.toInt().toString() : _calculatedResult.toStringAsFixed(1);

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: NopaDialogContainer(
              maxWidth: 420,
              radius: 22,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top Header: Flame/Fire Icon in circle on top right in RTL + Title in center
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      // Fire/Flame Icon on Right in RTL
                      Align(
                        alignment: Alignment.centerRight,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFF3F3765),
                          ),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/svg_icons/fir01.svg',
                            width: 20,
                            height: 20,
                            fit: BoxFit.contain,
                            colorFilter: const ColorFilter.mode(
                              Color(0xFF8B88E8),
                              BlendMode.srcIn,
                            ),
                            errorBuilder: (context, error, stackTrace) => const Icon(
                              Icons.local_fire_department_rounded,
                              color: Color(0xFF8B88E8),
                              size: 20,
                            ),
                          ),
                        ),
                      ),

                      // Title in center
                      const Text(
                        'ثبت درخواست مبادله',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Row 1: ارائه: (Right pill, no fill) + Amount & Source asset (Left)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Right Pill in RTL (First child) - No fill color
                      Container(
                        width: 76,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF5A4E88),
                            width: 1.0,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'ارائه:',
                          style: TextStyle(
                            color: Color(0xFFE2E0F0),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${amountStr.toPersianDigits()} $_sourceAsset',
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Row 2: خرید: (Right pill, no fill) + Result & Target asset (Left)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Right Pill in RTL (First child) - No fill color
                      Container(
                        width: 76,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF5A4E88),
                            width: 1.0,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'خرید:',
                          style: TextStyle(
                            color: Color(0xFFE2E0F0),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${resultStr.toPersianDigits()} $_targetAsset',
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Description text
                  const Text(
                    'درخواست شما پس از ثبت برای راهبر ارسال شده و در صورت تایید، خرید شما اعمال میشود. شما میتوانید با راهبر خود در ارتباط باشید.',
                    textAlign: TextAlign.justify,
                    style: TextStyle(
                      color: Color(0xFFB3AFD0),
                      fontSize: 11,
                      height: 1.45,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),

                  const SizedBox(height: 22),

                  // Bottom Action Buttons: ارسال (Right in RTL) & لغو (Left in RTL)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // ارسال on Right in RTL
                      TextButton(
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final success = await HttpApiService().submitStudentAssetConversion(
                            sourceAsset: _sourceAsset,
                            targetAsset: _targetAsset,
                            sourceAmount: amount,
                            targetAmount: _calculatedResult,
                          );
                          if (mounted) {
                            if (success) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('درخواست مبادله با موفقیت برای راهبر ارسال شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                  backgroundColor: Color(0xFF10B981),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              _loadMarketData();
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                  backgroundColor: Color(0xFFEF4444),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          }
                        },
                        child: const Text(
                          'ارسال',
                          style: TextStyle(
                            color: AppColors.buttonCamel,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),

                      // لغو on Left in RTL
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'لغو',
                          style: TextStyle(
                            color: AppColors.buttonCancelPurple,
                            fontSize: 14,
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
        );
      },
    );
  }

  void _contactMentor() {
    setState(() => _activeActionButton = 2);
    Navigator.pushNamed(context, '/tickets');
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        final user = repository.currentUser;
        final bool isMentor = user.role == UserRole.mentor || user.role == UserRole.superMentor;

        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Centered Page Title: "بازارچه"
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'بازارچه',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ),
              if (isMentor)
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: 20),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      user.caravanName ?? 'کاروان پنجم رضا جلالی',
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF9E9AC0).withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 18),

              // 2. Section 1: نرخنامه (Rate Sheet Cards)
              _buildRateSheetSection(),
              const SizedBox(height: 24),

              // 3. Section 2: سرمایه های شما (Your Capital - only for student)
              if (!isMentor) ...[
                _buildAssetsSection(user, isMentor: isMentor),
                const SizedBox(height: 24),
              ],

              // 4. Section 3: مبادله (for students) or گزارش اعضا و مبادلات (for mentor)
              if (isMentor)
                _buildMentorMarketSection()
              else
                _buildExchangePanel(),
              const SizedBox(height: 26),

              // 5. Section 4: برترین ها (لیگ / لیدربورد)
              _buildLeaderboardSection(user),
              const SizedBox(height: 40),
            ],
          ),
        );
      },
    );
  }

  /// Section 1: نرخنامه - Cards based on Home Station Cards with gallery SVG and divider line
  Widget _buildRateSheetSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'نرخنامه',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 145,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              itemCount: _rateItems.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = _rateItems[index];
                return _buildRateCard(item);
              },
            ),
          ),
        ),
      ],
    );
  }

  /// Single Rate Sheet Card matching Station Card design with gradient divider line
  Widget _buildRateCard(Map<String, dynamic> item) {
    return Container(
      width: 106,
      height: 145,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
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
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border width
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18.8),
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
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18.8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Upper Content: Gallery SVG Icon + Item Title
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SvgPicture.asset(
                      'assets/svg_icons/imagenot01.svg',
                      width: 32,
                      height: 32,
                      fit: BoxFit.contain,
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        item['title'] as String,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          height: 1.2,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 2. Middle Divider Line matching Station Cards in Home
              Container(
                height: 1.2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
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
              ),

              // 3. Bottom Footer Pill: Price Tag (e.g. 500 زریک, 5 نخ, غیر قابل خرید)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 5.5, horizontal: 4),
                decoration: const BoxDecoration(
                  color: Color(0xFF23223D),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(18.8)),
                ),
                child: Center(
                  child: Text(
                    (item['priceText'] as String).toPersianDigits(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFD6D3E6),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Section 2: سرمایه های شما / مجموع سرمایه های کاروان
  Widget _buildAssetsSection(UserModel? user, {bool isMentor = false}) {
    final title = isMentor ? 'مجموع سرمایه های کاروان' : 'سرمایه های شما';

    int totalZarik = user?.zarik ?? 0;
    int totalBeyragh = user?.beyragh ?? 0;
    int totalNakh = user?.nakh ?? 0;
    int totalFarsh = user?.farsh ?? 0;

    if (isMentor && _mentorMembersAssets.isNotEmpty) {
      totalZarik = _mentorMembersAssets.fold<int>(0, (sum, m) => sum + ((m['zarik'] as num?)?.toInt() ?? (m['zarikBalance'] as num?)?.toInt() ?? 0));
      totalBeyragh = _mentorMembersAssets.fold<int>(0, (sum, m) => sum + ((m['beyragh'] as num?)?.toInt() ?? 0));
      totalNakh = _mentorMembersAssets.fold<int>(0, (sum, m) => sum + ((m['nakh'] as num?)?.toInt() ?? 0));
      totalFarsh = _mentorMembersAssets.fold<int>(0, (sum, m) => sum + ((m['farsh'] as num?)?.toInt() ?? 0));
    }

    final zarikVal = totalZarik.toPersian();
    final beyrahVal = totalBeyragh.toPersian();
    final nakhVal = totalNakh.toPersian();
    final farshVal = totalFarsh.toPersian();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 44,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                _buildAssetPill(
                  badgeNumber: '۱',
                  label: 'زریک',
                  value: zarikVal,
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۲',
                  label: 'درفش',
                  value: beyrahVal,
                  isGold: _selectedAssetIndex == 1,
                  onTap: () => setState(() => _selectedAssetIndex = 1),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۳',
                  label: 'نخ',
                  value: nakhVal,
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۴',
                  label: 'فرش',
                  value: farshVal,
                  isGold: _selectedAssetIndex == 3,
                  onTap: () => setState(() => _selectedAssetIndex = 3),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Mentor Market Section: [گزارش اعضا] & [مبادلات]
  Widget _buildMentorMarketSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Mode Switcher Pill Tabs matching Mentor Station Screen
        Center(
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
                    _buildMentorTabButton('گزارش اعضا', 0),
                    const SizedBox(width: 4),
                    _buildMentorTabButton('مبادلات', 1),
                  ],
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Content based on tab
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: _selectedMentorMarketTab == 0
              ? _buildMentorMembersReportList()
              : _buildMentorExchangesList(),
        ),
      ],
    );
  }

  Widget _buildMentorTabButton(String title, int tabIndex) {
    final bool isSelected = _selectedMentorMarketTab == tabIndex;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedMentorMarketTab = tabIndex;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
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

  /// List of Member Assets for Mentor
  Widget _buildMentorMembersReportList() {
    int totalZarik = 0;
    int totalNakh = 0;
    int totalFarsh = 0;
    int totalBeyragh = 0;
    for (final m in _mentorMembersAssets) {
      totalZarik += (m['zarik'] as int? ?? 0);
      totalNakh += (m['nakh'] as int? ?? 0);
      totalFarsh += (m['farsh'] as int? ?? 0);
      totalBeyragh += (m['beyragh'] as int? ?? 0);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _mentorMembersAssets.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final member = _mentorMembersAssets[index];
            final memberId = member['id'] as String;
            final isExpanded = _expandedMemberAssetIds.contains(memberId);

            return _buildMentorMemberAssetCard(member, memberId, isExpanded);
          },
        ),
        const SizedBox(height: 14),
        // Compact textual summary of total assets under member reports box
        Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFF282548).withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF6C649B).withValues(alpha: 0.28),
                width: 0.9,
              ),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceAround,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 6,
              children: [
                Text(
                  'مجموع سرمایه‌ها:',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFC5BEEB),
                  ),
                ),
                Text(
                  'زریک: ${totalZarik.toString().toPersian()}',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFFFD54F),
                  ),
                ),
                Text(
                  'نخ: ${totalNakh.toString().toPersian()}',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF81D4FA),
                  ),
                ),
                Text(
                  'فرش: ${totalFarsh.toString().toPersian()}',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFA5D6A7),
                  ),
                ),
                Text(
                  'درفش: ${totalBeyragh.toString().toPersian()}',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFFFAB91),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMentorMemberAssetCard(Map<String, dynamic> member, String memberId, bool isExpanded) {
    final name = member['name'] as String;
    final zarik = (member['zarik'] as int).toString();
    final derafsh = (member['beyragh'] as int).toString();
    final nakh = (member['nakh'] as int).toString();
    final farsh = (member['farsh'] as int).toString();

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
      padding: const EdgeInsets.all(1.2), // Gradient border matching Mentor Station
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Member Header (Capsule gradient surface matching Mentor Station)
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedMemberAssetIds.remove(memberId);
                  } else {
                    _expandedMemberAssetIds.add(memberId);
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
                      // 1. Right side in RTL: Avatar + Name
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
                            child: const Icon(
                              Icons.person_rounded,
                              color: Color(0xFFEDE9F6),
                              size: 17,
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

                      // 2. Left side in RTL: "ارتباط" Button + Chevron
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () {
                              Navigator.pushNamed(context, '/tickets');
                            },
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
                                  'ارتباط',
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

            // Expanded Asset Values Row (Matching Dark Body style)
            if (isExpanded)
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF1B192A),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMemberAssetChip('زریک', zarik),
                      _buildMemberAssetChip('درفش', derafsh),
                      _buildMemberAssetChip('نخ', nakh),
                      _buildMemberAssetChip('فرش', farsh),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMemberAssetChip(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFFDFB690),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          '$label: ',
          style: TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 11,
            fontWeight: FontWeight.normal,
            color: Colors.white.withValues(alpha: 0.6),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 11.5,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  /// List of Student Exchange Requests for Mentor
  Widget _buildMentorExchangesList() {
    if (_mentorExchangeRequests.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'هیچ درخواست مبادله‌ای در انتظار نیست',
            style: TextStyle(
              fontFamily: AppTheme.fontFamily,
              color: Colors.white.withValues(alpha: 0.6),
            ),
          ),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _mentorExchangeRequests.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final request = _mentorExchangeRequests[index];
        final reqId = request['id'] as String;
        final isExpanded = _expandedExchangeIds.contains(reqId);

        return _buildMentorExchangeCard(request, reqId, isExpanded);
      },
    );
  }

  Widget _buildMentorExchangeCard(Map<String, dynamic> request, String reqId, bool isExpanded) {
    final studentName = request['studentName'] as String;
    final title = request['title'] as String;
    final date = request['date'] as String;

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
      padding: const EdgeInsets.all(1.2), // Gradient border matching Mentor Station
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Row (مبادله سمت راست، نام فرد سمت چپ)
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedExchangeIds.remove(reqId);
                  } else {
                    _expandedExchangeIds.add(reqId);
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
                      // 1. Right side in RTL: مبادله (آیکون مبادله + عنوان مبادله)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: const Color(0xFF4A382A),
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(
                                color: const Color(0xFFC09268).withValues(alpha: 0.5),
                                width: 1,
                              ),
                            ),
                            child: const Icon(
                              Icons.swap_horiz_rounded,
                              color: Color(0xFFDFB690),
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            title,
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

                      // 2. Left side in RTL: نام فرد + آیکون + فلش آکاردئونی
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF534C82),
                              border: Border.all(
                                color: const Color(0xFF837CB7).withValues(alpha: 0.5),
                                width: 1,
                              ),
                            ),
                            child: const Icon(
                              Icons.person_rounded,
                              color: Color(0xFFEDE9F6),
                              size: 14,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            studentName,
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.white.withValues(alpha: 0.9),
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

            // Expanded Body: تاریخ سمت راست، تایید و رد و توضیح سمت چپ
            if (isExpanded)
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF1B192A),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right side in RTL: تاریخ
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFFDFB690),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'تاریخ: $date',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                              fontSize: 11,
                              fontWeight: FontWeight.normal,
                              color: Colors.white.withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: قسمت تایید و رد و توضیح
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // تایید (Approve)
                          GestureDetector(
                            onTap: () async {
                              final success = await HttpApiService().approveCaravanAssetConversion(reqId, true);
                              if (mounted) {
                                setState(() {
                                  _mentorExchangeRequests.removeWhere((r) => r['id'] == reqId);
                                });
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      success
                                          ? 'درخواست مبادله برای $studentName تایید شد ✅'
                                          : 'خطا در ثبت تایید در سرور',
                                      style: const TextStyle(fontFamily: AppTheme.fontFamily),
                                    ),
                                    backgroundColor: success ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                                _loadMarketData();
                              }
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: AppColors.strokeGradient,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              padding: const EdgeInsets.all(AppColors.borderWidth),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                                decoration: BoxDecoration(
                                  gradient: AppColors.darkSurfaceGradient,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: const Text(
                                  'تایید',
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

                          // رد و توضیح (Reject & Explain)
                          GestureDetector(
                            onTap: () {
                              _showRejectExplanationDialog(
                                memberName: studentName,
                                requestDate: date,
                                requestSubject: 'رد درخواست مبادله',
                                onConfirmReject: () async {
                                  await HttpApiService().approveCaravanAssetConversion(reqId, false);
                                  if (mounted) {
                                    setState(() {
                                      _mentorExchangeRequests.removeWhere((r) => r['id'] == reqId);
                                    });
                                    _loadMarketData();
                                  }
                                },
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                              decoration: BoxDecoration(
                                color: Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: const Color(0xFF7B75AF).withValues(alpha: 0.8),
                                  width: 1,
                                ),
                              ),
                              child: const Text(
                                'رد و توضیح',
                                style: TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFDCD7F5),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Reject & Explain Dialog matching Image 2
  void _showRejectExplanationDialog({
    required String memberName,
    required String requestDate,
    required String requestSubject,
    required VoidCallback onConfirmReject,
  }) {
    final TextEditingController explanationController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xFF2C274A),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: const Color(0xFF4C4578),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top Header: Shield outline icon with user + Title
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      Align(
                        alignment: Alignment.centerRight,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: const Color(0xFFC09268).withValues(alpha: 0.7),
                              width: 1.2,
                            ),
                          ),
                          child: const Icon(
                            Icons.shield_outlined,
                            color: Color(0xFFDFB690),
                            size: 22,
                          ),
                        ),
                      ),
                      const Text(
                        'پیام به دانش آموز',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Field 1: نام و نام خانوادگی
                  _buildDialogField(
                    label: 'نام و نام خانوادگی',
                    value: memberName,
                  ),
                  const SizedBox(height: 12),

                  // Field 2: تاریخ
                  _buildDialogField(
                    label: 'تاریخ',
                    value: requestDate,
                  ),
                  const SizedBox(height: 12),

                  // Field 3: موضوع:
                  _buildDialogField(
                    label: 'موضوع:',
                    value: requestSubject,
                  ),
                  const SizedBox(height: 12),

                  // Field 4: شرح دهید: (Multiline)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(
                        width: 90,
                        child: Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'شرح دهید:',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 13,
                              color: Color(0xFFC7C5DD),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Container(
                          height: 110,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1A38),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFF4C4578),
                              width: 1.0,
                            ),
                          ),
                          child: TextField(
                            controller: explanationController,
                            maxLines: 4,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            decoration: const InputDecoration(
                              isDense: true,
                              hintText: 'توضیحات تان درمورد تصمیم تان را برای عضو مورد نظر بنویسید',
                              hintStyle: TextStyle(
                                color: Color(0xFF8882A8),
                                fontSize: 11.5,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Bottom Buttons: ارسال (Right) & لغو (Left)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // ارسال (Send)
                      TextButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          onConfirmReject();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'درخواست رد شد و پیام توضیح برای دانش‌آموز ارسال گردید.',
                                style: TextStyle(fontFamily: AppTheme.fontFamily),
                              ),
                              backgroundColor: Color(0xFFEF4444),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: const Text(
                          'ارسال',
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFE5A855),
                          ),
                        ),
                      ),

                      // لغو (Cancel)
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'لغو',
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF9E9CD6),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDialogField({required String label, required String value}) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 13,
              color: Color(0xFFC7C5DD),
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A38),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFF4C4578),
                width: 1.0,
              ),
            ),
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }


  Widget _buildAssetPill({
    required String badgeNumber,
    required String label,
    required String value,
    required bool isGold,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 130),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: isGold
              ? const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: [0.0, 0.5, 1.0],
                  colors: [
                    Color(0xFF8D5B2C),
                    Color(0xFFFFD580),
                    Color(0xFF8D5B2C),
                  ],
                )
              : const LinearGradient(
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
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(1.2),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20.8),
            gradient: isGold
                ? const LinearGradient(
                    colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: isGold ? null : const Color(0xFF28274A),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Right: Circular Badge with Number
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: isGold ? const Color(0xFF653A18) : const Color(0xFF8B88E8),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      badgeNumber,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Middle: Label
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 16),
                // Left: Value
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Section 3: مبادله - Purple Box based on Station Card with black selector boxes and responsive layout
  Widget _buildExchangePanel() {
    final String resultDisplay = _calculatedResult % 1 == 0
        ? _calculatedResult.toInt().toString().toPersianDigits()
        : _calculatedResult.toStringAsFixed(1).toPersianDigits();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'مبادله',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18.0),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
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
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            padding: const EdgeInsets.all(1.2),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20.8),
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
              ),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final bool isCompact = constraints.maxWidth < 460;

                    if (isCompact) {
                      // Compact mobile layout: Inputs on top -> Description -> Action Buttons on bottom
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // 1. Inputs Section
                          _buildExchangeInputsSection(resultDisplay),
                          const SizedBox(height: 14),

                          // 2. Description text
                          const Text(
                            'پس از تعیین مقدار مبادله، ثبت درخواست را بزنید تا درخواست شما برای مربی ارسال شود. درصورت تایید مربی مبادله شما نهایی خواهد شد.',
                            textAlign: TextAlign.justify,
                            style: TextStyle(
                              color: Color(0xFFC7C5DD),
                              fontSize: 11,
                              height: 1.45,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                          const SizedBox(height: 14),

                          // 3. Buttons Row
                          Row(
                            children: [
                              Expanded(
                                child: _buildInteractiveActionButton(
                                  text: 'ارتباط با راهبر',
                                  isActive: _activeActionButton == 2,
                                  strokeBorderColor: const Color(0xFF6E688E),
                                  onTap: _contactMentor,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _buildInteractiveActionButton(
                                  text: 'ثبت درخواست',
                                  isActive: _activeActionButton == 1,
                                  strokeBorderColor: const Color(0xFFC09268),
                                  onTap: _submitExchangeRequest,
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    }

                    // Wider screen layout: 2 balanced columns matching reference screenshot
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Left in RTL (Description text on top + 2 action buttons on bottom)
                        Expanded(
                          flex: 5,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(left: 6.0, top: 2.0),
                                child: Text(
                                  'پس از تعیین مقدار مبادله، ثبت درخواست را بزنید تا درخواست شما برای مربی ارسال شود. درصورت تایید مربی مبادله شما نهایی خواهد شد.',
                                  textAlign: TextAlign.justify,
                                  style: TextStyle(
                                    color: Color(0xFFC7C5DD),
                                    fontSize: 11,
                                    height: 1.45,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildInteractiveActionButton(
                                      text: 'ارتباط با راهبر',
                                      isActive: _activeActionButton == 2,
                                      strokeBorderColor: const Color(0xFF6E688E),
                                      onTap: _contactMentor,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _buildInteractiveActionButton(
                                      text: 'ثبت درخواست',
                                      isActive: _activeActionButton == 1,
                                      strokeBorderColor: const Color(0xFFC09268),
                                      onTap: _submitExchangeRequest,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),

                        // Right in RTL (Selectors & Amount inputs)
                        Expanded(
                          flex: 6,
                          child: _buildExchangeInputsSection(resultDisplay),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Right-side Inputs Section (سرمایه ارائه شده & سرمایه درخواستی)
  Widget _buildExchangeInputsSection(String resultDisplay) {
    return Column(
      children: [
        // Row 1: سرمایه ارائه شده
        Row(
          children: [
            const SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nارائه شده',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  height: 1.2,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              flex: 5,
              child: _buildAssetDropdown(
                value: _sourceAsset,
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _sourceAsset = val);
                    _recalculateExchange();
                  }
                },
              ),
            ),
            const SizedBox(width: 6),
            const Text(
              'مقدار',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 10.5,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
            const SizedBox(width: 4),
            _buildAmountInputBox(),
          ],
        ),

        const SizedBox(height: 10),

        // Row 2: سرمایه درخواستی
        Row(
          children: [
            const SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nدرخواستی',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  height: 1.2,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              flex: 5,
              child: _buildAssetDropdown(
                value: _targetAsset,
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _targetAsset = val);
                    _recalculateExchange();
                  }
                },
              ),
            ),
            const SizedBox(width: 6),
            const Text(
              'مقدار',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 10.5,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
            const SizedBox(width: 4),
            _buildResultBox(resultDisplay),
          ],
        ),
      ],
    );
  }

  /// Dark Asset Selector Dropdown Box matching notification and login dark surface styling
  Widget _buildAssetDropdown({
    required String value,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            dropdownColor: const Color(0xFF1E1633),
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFFC7B299), size: 18),
            isDense: true,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
            ),
            items: _availableAssets.map((asset) {
              return DropdownMenuItem<String>(
                value: asset,
                child: Text(asset, style: const TextStyle(fontSize: 12, color: Colors.white)),
              );
            }).toList(),
            onChanged: onChanged,
          ),
        ),
      ),
    );
  }

  /// Dark Amount Input Box matching notification action button style
  Widget _buildAmountInputBox() {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
          ),
          decoration: const InputDecoration(
            isDense: true,
            contentPadding: EdgeInsets.zero,
            border: InputBorder.none,
          ),
        ),
      ),
    );
  }

  /// Dark Result Box matching notification action button style
  Widget _buildResultBox(String resultText) {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: Text(
          resultText,
          style: const TextStyle(
            color: Color(0xFFFFD580),
            fontSize: 13,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
      ),
    );
  }

  /// Interactive Action Button: Stroke border initially, becomes filled/colored when active/pressed
  Widget _buildInteractiveActionButton({
    required String text,
    required bool isActive,
    required Color strokeBorderColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 42,
          decoration: BoxDecoration(
            gradient: isActive ? AppColors.accentGradient : null,
            color: isActive ? null : const Color(0xFF282842),
            borderRadius: BorderRadius.circular(10),
            border: isActive
                ? null
                : Border.all(
                    color: strokeBorderColor,
                    width: 1.2,
                  ),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: const Color(0xFFC7844E).withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              text,
              style: TextStyle(
                color: isActive ? Colors.white : const Color(0xFFD6D7E5),
                fontSize: 13.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Section 4: برترین ها (لیگ) - Top 3 Podium & Leaderboard Switcher
  Widget _buildLeaderboardSection(UserModel? user) {
    // Top 3 Data based on selected tab
    final List<Map<String, dynamic>> topMembers = [
      {
        'rank': 1,
        'name': 'حسینعلی فقیه',
        'zarik': '5500 زریک',
        'color': const Color(0xFFFFD580),
        'borderColor': const Color(0xFFFFD580),
        'size': 92.0,
      },
      {
        'rank': 2,
        'name': 'رضا شفیعی',
        'zarik': '4100 زریک',
        'color': const Color(0xFFCBD5E1),
        'borderColor': const Color(0xFFCBD5E1),
        'size': 78.0,
      },
      {
        'rank': 3,
        'name': 'مسلم عارف',
        'zarik': '4000 زریک',
        'color': const Color(0xFFC8824C),
        'borderColor': const Color(0xFFC8824C),
        'size': 72.0,
      },
    ];

    final List<Map<String, dynamic>> topCaravans = [
      {
        'rank': 1,
        'name': 'کاروان پنجم',
        'zarik': '18,500 زریک',
        'color': const Color(0xFFFFD580),
        'borderColor': const Color(0xFFFFD580),
        'size': 92.0,
      },
      {
        'rank': 2,
        'name': 'کاروان سوم',
        'zarik': '14,200 زریک',
        'color': const Color(0xFFCBD5E1),
        'borderColor': const Color(0xFFCBD5E1),
        'size': 78.0,
      },
      {
        'rank': 3,
        'name': 'کاروان هفتم',
        'zarik': '11,800 زریک',
        'color': const Color(0xFFC8824C),
        'borderColor': const Color(0xFFC8824C),
        'size': 72.0,
      },
    ];

    final currentList = _selectedLeaderboardTab == 0 ? topMembers : topCaravans;
    final firstPlace = currentList[0];
    final secondPlace = currentList[1];
    final thirdPlace = currentList[2];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Header Title: "برترین ها"
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'برترین ها',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // 2. Tab Switcher Box styled like Login OTP/Password Segmented Box
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
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
                  children: [
                    // Tab 0: برترین شرکت کننده ها
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedLeaderboardTab = 0),
                        behavior: HitTestBehavior.opaque,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            gradient: _selectedLeaderboardTab == 0 ? AppColors.accentGradient : null,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              'برترین شرکت کننده ها',
                              style: TextStyle(
                                color: _selectedLeaderboardTab == 0 ? Colors.white : const Color(0xFF8E889D),
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(width: 4),

                    // Tab 1: برترین کاروان ها
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedLeaderboardTab = 1),
                        behavior: HitTestBehavior.opaque,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            gradient: _selectedLeaderboardTab == 1 ? AppColors.accentGradient : null,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              'برترین کاروان ها',
                              style: TextStyle(
                                color: _selectedLeaderboardTab == 1 ? Colors.white : const Color(0xFF8E889D),
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 28),

        // 3. Podium of Top 3 (RTL: Right = 2nd, Center = 1st, Left = 3rd)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Right: 2nd Place (Silver)
                Expanded(
                  child: _buildPodiumItem(
                    item: secondPlace,
                    rankNumber: '2',
                    rankColor: const Color(0xFFCBD5E1),
                    circleSize: 78.0,
                    iconTint: const Color(0xFFCBD5E1),
                  ),
                ),

                // Center: 1st Place (Gold - Largest)
                Expanded(
                  child: _buildPodiumItem(
                    item: firstPlace,
                    rankNumber: '1',
                    rankColor: const Color(0xFFFFD580),
                    circleSize: 94.0,
                    iconTint: const Color(0xFFFFD580),
                  ),
                ),

                // Left: 3rd Place (Bronze)
                Expanded(
                  child: _buildPodiumItem(
                    item: thirdPlace,
                    rankNumber: '3',
                    rankColor: const Color(0xFFC8824C),
                    circleSize: 72.0,
                    iconTint: const Color(0xFFC8824C),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 24),

        // 4. Bottom Footer Stats: "تعداد کل: 150" | "رتبه شما: 10"
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // تعداد کل
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13.5,
                      color: Color(0xFFC7C5DD),
                    ),
                    children: [
                      const TextSpan(text: 'تعداد کل: '),
                      TextSpan(
                        text: '150'.toPersianDigits(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 32),

                // رتبه شما
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13.5,
                      color: Color(0xFFC7C5DD),
                    ),
                    children: [
                      const TextSpan(text: 'رتبه شما: '),
                      TextSpan(
                        text: '10'.toPersianDigits(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Single Podium Item (Clean Flat Avatar without neon glow, with Rank Number placed on the RIGHT of the name)
  Widget _buildPodiumItem({
    required Map<String, dynamic> item,
    required String rankNumber,
    required Color rankColor,
    required double circleSize,
    required Color iconTint,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Clean Circle Avatar with solid matching border (no neon/glowing shadows)
        Container(
          width: circleSize,
          height: circleSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF28274A),
            border: Border.all(
              color: rankColor,
              width: rankNumber == '1' ? 2.0 : 1.6,
            ),
          ),
          child: Center(
            child: SvgPicture.asset(
              'assets/svg_icons/profile01.svg',
              width: circleSize * 0.52,
              height: circleSize * 0.52,
              fit: BoxFit.contain,
              colorFilter: ColorFilter.mode(iconTint, BlendMode.srcIn),
            ),
          ),
        ),

        const SizedBox(height: 10),

        // Name & Rank Number row: Rank Number placed on the RIGHT in RTL
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // 1. Right in RTL: Rank Number (1, 2, 3)
            Text(
              rankNumber.toPersianDigits(),
              style: TextStyle(
                color: rankColor,
                fontSize: rankNumber == '1' ? 18 : 16,
                fontWeight: FontWeight.w900,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
            const SizedBox(width: 5),

            // 2. Left in RTL: Name (flat, non-luminous text)
            Flexible(
              child: Text(
                item['name'] as String,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 4),

        // Zarik Wealth (flat text, no glowing shadows)
        Text(
          (item['zarik'] as String).toPersianDigits(),
          style: const TextStyle(
            color: Color(0xFFFFD580),
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ],
    );
  }
}



typedef MarketScreen = StudentMarketScreen;
