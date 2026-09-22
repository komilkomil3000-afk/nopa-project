import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';
import '../utils/constants.dart';
import '../main.dart';

class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
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

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    _recalculateExchange();
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

  void _handleBackAction() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      navigateToMainTab(0); // Return to Home
    }
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
      builder: (BuildContext ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: const Color(0xFF28274A),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
              side: BorderSide(
                color: const Color(0xFF5A588B).withValues(alpha: 0.5),
                width: 1.2,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(
                    child: Text(
                      'تایید درخواست مبادله',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1D36),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF3D3B66), width: 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ارائه: ${amountStr.toPersianDigits()} $_sourceAsset',
                          style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: AppTheme.fontFamily),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'دریافت: ${resultStr.toPersianDigits()} $_targetAsset',
                          style: const TextStyle(
                            color: Color(0xFFFFD580),
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'درخواست شما پس از ثبت برای راهبر ارسال شده و در صورت تایید، سرمایه‌ها جابه‌جا می‌شوند.',
                    style: TextStyle(color: Colors.white60, fontSize: 11, height: 1.4, fontFamily: AppTheme.fontFamily),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('انصراف', style: TextStyle(color: Color(0xFF9D99B8), fontFamily: AppTheme.fontFamily)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('درخواست مبادله با موفقیت برای راهبر ارسال شد.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                backgroundColor: Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          child: Container(
                            height: 40,
                            decoration: BoxDecoration(
                              gradient: AppColors.accentGradient,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Center(
                              child: Text(
                                'ثبت نهایی',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
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

        return Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: AppColors.screenBackgroundGradient,
            image: DecorationImage(
              image: AssetImage('assets/images/login_bg.png'),
              fit: BoxFit.cover,
            ),
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. Top Bar: NOPA Logo + Back SVG Icon on Left, Bell + Drawer Menu on Right
                  _buildTopBar(),

                  // 2. Centered Page Title: "بازارچه"
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
                  const SizedBox(height: 18),

                  // 3. Section 1: نرخنامه (Rate Sheet Cards)
                  _buildRateSheetSection(),
                  const SizedBox(height: 24),

                  // 4. Section 2: سرمایه های شما (Your Capital)
                  _buildAssetsSection(user),
                  const SizedBox(height: 24),

                  // 5. Section 3: مبادله (Exchange Panel)
                  _buildExchangePanel(),
                  const SizedBox(height: 26),

                  // 6. Section 4: برترین ها (لیگ / لیدربورد)
                  _buildLeaderboardSection(user),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Top Bar matching Challenges & Map screens
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, top: 10, bottom: 6),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: NOPA Logo + Back SVG Icon
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 42,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [
                          Color(0xFFC09268),
                          Color(0xFFF4DCC5),
                        ],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ).createShader(bounds),
                      child: const Text(
                        'NOPA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          fontFamily: 'ChochoAuraDemo',
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: _handleBackAction,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 4, right: 8),
                    child: SvgPicture.asset(
                      'assets/svg_icons/back01.svg',
                      width: 20,
                      height: 20,
                      colorFilter: const ColorFilter.mode(
                        Color(0xFFC7B299),
                        BlendMode.srcIn,
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // Right: Notification Bell Button + Drawer Hamburger Menu
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Consumer<AppRepository>(
                  builder: (context, repository, _) {
                    final count = repository.unreadNotificationsCount;
                    final bool hasUnread = count > 0;

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          repository.fetchNotifications();
                          Navigator.pushNamed(context, '/notifications');
                        },
                        borderRadius: BorderRadius.circular(22),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: const BoxDecoration(
                                color: Color(0xFF23223D),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.notifications_none_rounded,
                                  color: Color(0xFFC7B299),
                                  size: 23,
                                ),
                              ),
                            ),
                            if (hasUnread)
                              Positioned(
                                right: 0,
                                top: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEF4444),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF23223D), width: 1.5),
                                  ),
                                  child: Center(
                                    child: Text(
                                      count > 9 ? '+۹' : count.toPersian(),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                        height: 1,
                                        fontFamily: AppTheme.fontFamily,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(width: 10),
                Builder(
                  builder: (ctx) => Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => Scaffold.of(ctx).openDrawer(),
                      borderRadius: BorderRadius.circular(22),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: const BoxDecoration(
                          color: Color(0xFF23223D),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.menu_rounded,
                            color: Color(0xFFC7B299),
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Section 1: نرخنامه - Cards based on Home Station Cards with gallery SVG and footer price
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

  /// Single Rate Sheet Card matching Station Card design
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

              // 2. Bottom Footer Pill: Price Tag (e.g. 500 زریک, 5 نخ, غیر قابل خرید)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 5.5, horizontal: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF23223D).withValues(alpha: 0.75),
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18.8)),
                  border: const Border(
                    top: BorderSide(color: Color(0xFF43416A), width: 0.8),
                  ),
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

  /// Section 2: سرمایه های شما - Exact clone from Home Screen
  Widget _buildAssetsSection(UserModel? user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'سرمایه های شما',
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
                  value: (user?.zarik ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۲',
                  label: 'درفش',
                  value: (user?.beyragh ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 1,
                  onTap: () => setState(() => _selectedAssetIndex = 1),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۳',
                  label: 'نخ',
                  value: (user?.nakh ?? 0).toPersian(),
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۴',
                  label: 'فرش',
                  value: (user?.farsh ?? 0).toPersian(),
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

  /// Dark Asset Selector Dropdown Box matching challenge CTA box
  Widget _buildAssetDropdown({
    required String value,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF4A4778), width: 1.0),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          dropdownColor: const Color(0xFF28274A),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white70, size: 18),
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
    );
  }

  /// Dark Amount Input Box
  Widget _buildAmountInputBox() {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF4A4778), width: 1.0),
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
    );
  }

  /// Dark Result Box
  Widget _buildResultBox(String resultText) {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF4A4778), width: 1.0),
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

        // 2. Tab Switcher Box: "برترین شرکت کننده ها" | "برترین کاروان ها"
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFF1B1A32),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFF453F73).withValues(alpha: 0.6),
                width: 1.1,
              ),
            ),
            padding: const EdgeInsets.all(4),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                children: [
                  // Tab 0: برترین شرکت کننده ها
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedLeaderboardTab = 0),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        height: double.infinity,
                        decoration: BoxDecoration(
                          gradient: _selectedLeaderboardTab == 0 ? AppColors.accentGradient : null,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: _selectedLeaderboardTab == 0
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFFC7844E).withValues(alpha: 0.35),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            'برترین شرکت کننده ها',
                            style: TextStyle(
                              color: _selectedLeaderboardTab == 0 ? Colors.white : const Color(0xFFB5B3C8),
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Subtle divider between tabs
                  Container(
                    width: 1,
                    height: 22,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    color: const Color(0xFF453F73).withValues(alpha: 0.5),
                  ),

                  // Tab 1: برترین کاروان ها
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedLeaderboardTab = 1),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        height: double.infinity,
                        decoration: BoxDecoration(
                          gradient: _selectedLeaderboardTab == 1 ? AppColors.accentGradient : null,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: _selectedLeaderboardTab == 1
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFFC7844E).withValues(alpha: 0.35),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            'برترین کاروان ها',
                            style: TextStyle(
                              color: _selectedLeaderboardTab == 1 ? Colors.white : const Color(0xFFB5B3C8),
                              fontSize: 13,
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

  /// Single Podium Item (Circle Avatar with border + Rank Number + Name + Wealth)
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
        // Circle Avatar with matching border
        Container(
          width: circleSize,
          height: circleSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF28274A),
            border: Border.all(
              color: rankColor,
              width: rankNumber == '1' ? 2.2 : 1.8,
            ),
            boxShadow: [
              BoxShadow(
                color: rankColor.withValues(alpha: rankNumber == '1' ? 0.35 : 0.2),
                blurRadius: rankNumber == '1' ? 14 : 8,
                spreadRadius: 0.5,
              ),
            ],
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

        // Name & Rank Number row
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
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
            const SizedBox(width: 4),
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
          ],
        ),

        const SizedBox(height: 4),

        // Zarik Wealth
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
