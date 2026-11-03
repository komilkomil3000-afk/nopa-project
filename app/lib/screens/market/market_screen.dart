import 'package:nopa_app/core/economy_rates.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:nopa_app/widgets/nopa_pill_tabs.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/asset_names.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
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
import 'package:nopa_app/utils/mentor_contact.dart';

/// Who the market is shown to. The two share the rate sheet and the leaderboard:
/// - student: own capital, the exchange panel and "contact mentor";
/// - mentor: the caravan's members report and exchanges (observer view, can cancel), synced to the picked caravan.
enum MarketMode { student, mentor }

/// The بازارچه tab for students and mentors (app_shell picks the mode from the role).
class MarketScreen extends StatefulWidget {
  final MarketMode mode;
  const MarketScreen({super.key, required this.mode});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  bool get _isMentor => widget.mode == MarketMode.mentor;

  // Rate sheet; kalaf and carpet follow the rules set in the panel, banners are only won
  List<Map<String, dynamic>> get _rateItems => [
    {
      'title': 'کلاف',
      'priceText': EconomyRates.allowBuyNakh ? '${EconomyRates.zarikPerNakh} زریک' : 'غیر قابل خرید',
      'assetKey': 'کلاف',
    },
    {
      'title': 'قالیچه',
      'priceText': '${EconomyRates.nakhPerFarsh} کلاف',
      'assetKey': 'قالیچه',
    },
    {
      'title': 'درفش برنزی',
      'priceText': 'غیر قابل خرید',
      'assetKey': 'درفش برنزی',
    },
    {
      'title': 'درفش نقره ای',
      'priceText': 'غیر قابل خرید',
      'assetKey': 'درفش نقره ای',
    },
    {
      'title': 'درفش طلایی',
      'priceText': 'غیر قابل خرید',
      'assetKey': 'درفش طلایی',
    },
  ];

  // Selected asset index for "سرمایه های شما"
  int _selectedAssetIndex = 0;

  // Selected tab for "برترین ها (لیگ)" (0: برترین شرکت کننده ها, 1: برترین کاروان ها)
  int _selectedLeaderboardTab = 0;

  // Leaderboard data (from /leagues/*)
  List<Map<String, String>> _topMembers = [];
  List<Map<String, String>> _topCaravans = [];
  List<String> _memberIds = [];
  List<String> _caravanIds = [];

  // Exchange calculator states
  String _sourceAsset = 'کلاف';
  String _targetAsset = 'قالیچه';
  final TextEditingController _amountController = TextEditingController(text: EconomyRates.nakhPerFarsh.toString());
  double _calculatedResult = 1.0;

  // Interactive button selection states (0: none, 1: submit active, 2: mentor active)
  int _activeActionButton = 1; // Default: 'ثبت درخواست' is active/colored

  final List<String> _availableAssets = ['زریک', 'کلاف', 'قالیچه'];

  // Mentor Market States
  int _selectedMentorMarketTab = 0; // 0: گزارش اعضا, 1: مبادلات
  final Set<String> _expandedMemberAssetIds = {};
  final Set<String> _expandedExchangeIds = {};

  List<Map<String, dynamic>> _mentorMembersAssets = [];
  List<Map<String, dynamic>> _mentorExchangeRequests = [];

  // Sync state: the caravan the lists belong to, so switching caravans reloads them
  String? _loadedCaravanId;
  bool _marketLoading = true;
  bool _marketLoadFailed = false;
  int _marketLoadToken = 0;

  static int _asInt(dynamic v) => v is num ? v.toInt() : (int.tryParse(v?.toString() ?? '') ?? 0);

  /// Title of an exchange row: the stored note, or "N source → M target" built from the request.
  String _exchangeTitle(Map<String, dynamic> req) {
    final note = req['note']?.toString().trim() ?? '';
    if (note.isNotEmpty) return note;
    final source = req['sourceAsset']?.toString();
    final target = req['targetAsset']?.toString();
    if (source == null || target == null) return 'درخواست تبدیل دارایی';
    String label(String key) => AssetNames.of(key);
    return '${_asInt(req['sourceAmount']).toString().toPersianDigits()} ${label(source)} به '
        '${_asInt(req['targetAmount']).toString().toPersianDigits()} ${label(target)}';
  }

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

  /// Loads the members report and the exchanges of the caravan picked in the app.
  /// A newer call wins: a slow answer for a caravan the mentor already left is dropped.
  Future<void> _loadMarketData() async {
    final caravanId = Provider.of<AppRepository>(context, listen: false).selectedCaravanId;
    final token = ++_marketLoadToken;
    _loadedCaravanId = caravanId;
    if (mounted) {
      setState(() {
        _marketLoading = true;
        _marketLoadFailed = false;
      });
    }
    try {
      final api = HttpApiService();
      final results = await Future.wait<dynamic>([
        api.getMentorCaravanProgress(caravanId: caravanId),
        api.getCaravanAssetConversions(caravanId: caravanId),
      ]);
      if (!mounted || token != _marketLoadToken) return;
      final progressData = results[0] as Map<String, dynamic>?;
      final exchangeData = results[1] as List<Map<String, dynamic>>;

      setState(() {
        _marketLoading = false;
        if (progressData == null) {
          _marketLoadFailed = true;
        } else {
          final members = (progressData['members'] as List?) ?? const [];
          _mentorMembersAssets = members.whereType<Map<String, dynamic>>().map((m) => {
                ...m,
                'id': m['id']?.toString() ?? '',
                'name': m['name']?.toString() ?? 'عضو کاروان',
                'zarik': _asInt(m['zarik'] ?? m['zarikBalance']),
                'nakh': _asInt(m['nakh']),
                'farsh': _asInt(m['farsh']),
                'beyragh': _asInt(m['beyragh']),
              }).toList();
          _expandedMemberAssetIds.retainWhere((id) => _mentorMembersAssets.any((m) => m['id'] == id));
        }
        _mentorExchangeRequests = exchangeData.map((req) {
          final student = req['user'] as Map<String, dynamic>?;
          return <String, dynamic>{
            'id': req['id']?.toString() ?? '',
            'studentName': student?['name']?.toString() ?? 'دانش‌آموز',
            'studentId': req['requestedBy']?.toString() ?? '',
            'title': _exchangeTitle(req),
            'date': _formatPersianDate(req['createdAt']),
            'status': req['status']?.toString() ?? 'completed',
            'createdAt': req['createdAt']?.toString() ?? '',
          };
        }).toList();
      });
    } catch (e) {
      debugPrint('Error loading market data: $e');
      if (mounted && token == _marketLoadToken) {
        setState(() {
          _marketLoading = false;
          _marketLoadFailed = true;
        });
      }
    }
  }

  Future<void> _refreshAll() => Future.wait([_loadMarketData(), _loadLeaderboards()]);

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    _recalculateExchange();
    if (_isMentor) _loadMarketData();
    _loadLeaderboards();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _recalculateExchange() {
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final rule = EconomyRates.rule(_sourceAsset, _targetAsset);

    setState(() {
      _calculatedResult = rule != null && amount > 0 ? (amount / rule.step) * rule.pays : 0.0;
    });
  }

  void _submitExchangeRequest() {
    setState(() => _activeActionButton = 1);
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    if (amount <= 0) {
      AppToast.error(context, 'لطفاً مقدار معتبری برای مبادله وارد کنید.');
      return;
    }

    final rule = EconomyRates.rule(_sourceAsset, _targetAsset);
    if (rule == null) {
      AppToast.error(context, 'تبدیل $_sourceAsset به $_targetAsset امکان‌پذیر نیست.');
      return;
    }
    if (amount % rule.step != 0) {
      AppToast.error(context, 'مقدار $_sourceAsset باید مضربی از ${rule.step.toString().toPersianDigits()} باشد.');
      return;
    }

    // Balance check: amount must not exceed the user's holdings
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    final double? balance = switch (_sourceAsset) {
      'زریک' => user.zarik.toDouble(),
      'کلاف' => user.nakh.toDouble(),
      'قالیچه' => user.farsh.toDouble(),
      _ => null,
    };
    if (balance != null && amount > balance) {
      AppToast.error(context, 'دارایی شما کافی نیست.');
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
                        style: AppTypography.h2,
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
                        child: Text(
                          'ارائه:',
                          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFE2E0F0)),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${amountStr.toPersianDigits()} $_sourceAsset',
                        style: AppTypography.h3.copyWith(color: Color(0xFFE2E0F0)),
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
                        child: Text(
                          'خرید:',
                          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFE2E0F0)),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${resultStr.toPersianDigits()} $_targetAsset',
                        style: AppTypography.h3.copyWith(color: Color(0xFFE2E0F0)),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Description text
                  Text(
                    'درخواست شما پس از ثبت برای راهبر ارسال شده و در صورت تایید، خرید شما اعمال میشود. شما میتوانید با راهبر خود در ارتباط باشید.',
                    textAlign: TextAlign.justify,
                    style: AppTypography.caption.copyWith(color: Color(0xFFB3AFD0)),
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
                          final repository = Provider.of<AppRepository>(context, listen: false);
                          final error = await HttpApiService().submitStudentAssetConversion(
                            sourceAsset: _sourceAsset,
                            targetAsset: _targetAsset,
                            sourceAmount: amount,
                            targetAmount: _calculatedResult,
                          );
                          if (mounted) {
                            if (error == null) {
                              AppToast.success(context, 'مبادله انجام شد و راهبر از آن مطلع شد');
                              repository.refreshUser();
                              _loadLeaderboards();
                            } else {
                              AppToast.error(context, error);
                            }
                          }
                        },
                        child: Text(
                          'ارسال',
                          style: AppTypography.h3.copyWith(color: AppColors.buttonCamel),
                        ),
                      ),

                      // لغو on Left in RTL
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: Text(
                          'لغو',
                          style: AppTypography.h3.copyWith(color: AppColors.buttonCancelPurple),
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

  String _formatScore(dynamic value) {
    final n = (value is num) ? value.round() : (int.tryParse(value?.toString() ?? '') ?? 0);
    return n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  }

  Future<void> _loadLeaderboards() async {
    try {
      final api = HttpApiService();
      final members = await api.getWealthiestLeague();
      final caravans = await api.getCaravanLeague(sortBy: 'wealth');
      if (!mounted) return;
      setState(() {
        _memberIds = members.map((m) => m['id']?.toString() ?? '').toList();
        _topMembers = members.take(3).map((m) => {
              'name': m['name']?.toString() ?? '-',
              'zarik': '${_formatScore(m['capital'] ?? m['zarikBalance'])} زریک',
            }).toList();
        _caravanIds = caravans.map((c) => c['id']?.toString() ?? '').toList();
        _topCaravans = caravans.take(3).map((c) => {
              'name': c['name']?.toString() ?? '-',
              'zarik': '${_formatScore(c['averageWealth'] ?? c['totalWealth'])} زریک',
            }).toList();
      });
    } catch (e) {
      debugPrint('Error loading leaderboards: $e');
    }
  }

  void _contactMentor() {
    setState(() => _activeActionButton = 2);
    contactMentor(context, Provider.of<AppRepository>(context, listen: false).currentUser);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        final user = repository.currentUser;
        final bool isMentor = _isMentor;

        // The mentor switched caravans (or the caravan list arrived after the first load): resync
        if (isMentor && _loadedCaravanId != null && repository.selectedCaravanId != _loadedCaravanId) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadMarketData();
          });
          _loadedCaravanId = repository.selectedCaravanId;
        }

        return RefreshIndicator(
          onRefresh: _refreshAll,
          notificationPredicate: isMentor ? defaultScrollNotificationPredicate : (_) => false,
          child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Centered Page Title: "بازارچه"
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'بازارچه',
                  style: AppTypography.h1,
                ),
              ),
              if (isMentor)
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: 20),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      repository.selectedCaravanName,
                      style: AppTypography.h3.copyWith(color: const Color(0xFF9E9AC0).withValues(alpha: 0.9)),
                    ),
                  ),
                ),
              const SizedBox(height: 18),

              // 2. Section 1: نرخنامه (Rate Sheet Cards)
              _buildRateSheetSection(),
              const SizedBox(height: 24),

              // 3. Section 2: سرمایه های شما (Your Capital - only for student)
              if (!isMentor) ...[
                _buildAssetsSection(user),
                const SizedBox(height: 24),
              ],

              // 4. Section 3: مبادله (for students) or گزارش اعضا و مبادلات (for mentor)
              if (isMentor)
                _buildMentorMarketSection()
              else
                _buildExchangePanel(),
              const SizedBox(height: 26),

              // 5. Section 4: برترین ها (لیگ / لیدربورد)
              _buildLeaderboardSection(user, myCaravanId: isMentor ? repository.selectedCaravanId : user.caravanId),
              const SizedBox(height: 40),
            ],
          ),
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
              style: AppTypography.h2,
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
                        AssetNames.labelFor(item['title'] as String),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: AppTypography.h3,
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
                    style: AppTypography.caption.copyWith(color: Color(0xFFD6D3E6)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Section 2: سرمایه های شما (student only; the mentor sees caravan totals under گزارش اعضا)
  Widget _buildAssetsSection(UserModel? user) {
    const title = 'سرمایه های شما';
    final int totalZarik = user?.zarik ?? 0;
    final int totalNakh = user?.nakh ?? 0;
    final int totalFarsh = user?.farsh ?? 0;

    final zarikVal = totalZarik.toPersian();
    final beyrahVal = Provider.of<AppRepository>(context).caravanBannerTotal.toPersian();
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
              style: AppTypography.h2,
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
                  label: AssetNames.labelFor('زریک'),
                  value: zarikVal,
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۲',
                  label: AssetNames.labelFor('درفش'),
                  value: beyrahVal,
                  isGold: _selectedAssetIndex == 1,
                  onTap: () => setState(() => _selectedAssetIndex = 1),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۳',
                  label: AssetNames.labelFor('کلاف'),
                  value: nakhVal,
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۴',
                  label: AssetNames.labelFor('قالیچه'),
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
        Center(
          child: NopaPillTabs<int>(
            selected: _selectedMentorMarketTab,
            tabs: const [
              NopaPillTab<int>(0, 'گزارش اعضا'),
              NopaPillTab<int>(1, 'مبادلات'),
            ],
            onChanged: (v) => setState(() => _selectedMentorMarketTab = v),
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

  /// List of Member Assets for Mentor
  /// Loading, failure and empty placeholder shared by the members report and the exchanges list.
  Widget? _marketStatusPlaceholder({required bool isEmpty, required String emptyText}) {
    if (_marketLoading && isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4))),
      );
    }
    if (!_marketLoadFailed && !isEmpty) return null;
    final failed = _marketLoadFailed;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: [
          Text(
            failed ? 'دریافت اطلاعات بازارچه ناموفق بود.' : emptyText,
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFFB3AFD0)),
          ),
          if (failed)
            TextButton(
              onPressed: _loadMarketData,
              child: Text(
                'تلاش دوباره',
                style: AppTypography.h3.copyWith(color: AppColors.buttonCamel),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMentorMembersReportList() {
    final placeholder = _marketStatusPlaceholder(
      isEmpty: _mentorMembersAssets.isEmpty,
      emptyText: 'هنوز عضوی در این کاروان نیست.',
    );
    if (placeholder != null && _mentorMembersAssets.isEmpty) return placeholder;

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
                  style: AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB)),
                ),
                Text(
                  'زریک: ${totalZarik.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFFFD54F)),
                ),
                Text(
                  '${AssetNames.labelFor('کلاف')}: ${totalNakh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFF81D4FA)),
                ),
                Text(
                  '${AssetNames.labelFor('قالیچه')}: ${totalFarsh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFA5D6A7)),
                ),
                Text(
                  '${AssetNames.labelFor('درفش')}: ${totalBeyragh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFFFAB91)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMentorMemberAssetCard(Map<String, dynamic> member, String memberId, bool isExpanded) {
    final name = member['name']?.toString() ?? 'عضو کاروان';
    final zarik = _asInt(member['zarik']).toString();
    final derafsh = _asInt(member['beyragh']).toString();
    final nakh = _asInt(member['nakh']).toString();
    final farsh = _asInt(member['farsh']).toString();

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
            TapExpander(child: InkWell(
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
                            style: AppTypography.bodyLarge,
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: "ارتباط" Button + Chevron
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TapExpander(child: GestureDetector(
                            onTap: () {
                              Navigator.pushNamed(context, AppRoutes.tickets);
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
                                child: Text(
                                  'ارتباط',
                                  style: AppTypography.caption.copyWith(color: Color(0xFFC7B299)),
                                ),
                              ),
                            ),
                          )),
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
            )),

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
                      _buildMemberAssetChip(AssetNames.labelFor('زریک'), zarik),
                      _buildMemberAssetChip(AssetNames.labelFor('درفش'), derafsh),
                      _buildMemberAssetChip(AssetNames.labelFor('کلاف'), nakh),
                      _buildMemberAssetChip(AssetNames.labelFor('قالیچه'), farsh),
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
          style: AppTypography.caption.copyWith(color: Colors.white.withValues(alpha: 0.6)),
        ),
        Text(
          value,
          style: AppTypography.caption,
        ),
      ],
    );
  }

  /// List of Student Exchange Requests for Mentor
  Widget _buildMentorExchangesList() {
    if (_mentorExchangeRequests.isEmpty) {
      return _marketStatusPlaceholder(isEmpty: true, emptyText: 'هیچ مبادله‌ای ثبت نشده است')!;
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
    final status = request['status'] as String;
    // Mentor may cancel a completed exchange only within 24h of its creation
    final createdAt = DateTime.tryParse(request['createdAt'] as String? ?? '');
    final canCancel = status == 'completed' &&
        createdAt != null &&
        DateTime.now().difference(createdAt) < const Duration(hours: 24);

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
            TapExpander(child: InkWell(
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
                                color: AppColors.buttonCamel.withValues(alpha: 0.5),
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
                            style: AppTypography.bodyLarge,
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
                            style: AppTypography.bodyMedium.copyWith(color: Colors.white.withValues(alpha: 0.9)),
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
            )),

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
                            style: AppTypography.caption.copyWith(color: Colors.white.withValues(alpha: 0.6)),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: وضعیت مبادله و دکمه لغو (فقط مشاهده؛ تایید لازم نیست)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (status == 'cancelled')
                            Text(
                              'لغو شد',
                              style: AppTypography.caption.copyWith(color: Colors.redAccent.withValues(alpha: 0.9)),
                            )
                          else ...[
                            Text(
                              'انجام شد',
                              style: AppTypography.caption.copyWith(color: Colors.greenAccent.withValues(alpha: 0.85)),
                            ),
                            if (canCancel) ...[
                              const SizedBox(width: 10),
                              TapExpander(child: GestureDetector(
                                onTap: () {
                                  _showRejectExplanationDialog(
                                    memberName: studentName,
                                    requestDate: date,
                                    requestSubject: 'لغو مبادله: $title',
                                    onConfirmReject: (reason) async {
                                      final error = await HttpApiService().cancelCaravanAssetConversion(reqId, reason: reason);
                                      if (!mounted) return;
                                      if (error == null) {
                                        AppToast.success(context, 'مبادله لغو و سرمایه‌ها به دانش‌آموز بازگردانده شد.');
                                      } else {
                                        AppToast.error(context, error);
                                      }
                                      _loadMarketData();
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
                                  child: Text(
                                    'لغو مبادله',
                                    style: AppTypography.caption.copyWith(color: Color(0xFFDCD7F5)),
                                  ),
                                ),
                              )),
                            ],
                          ],
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
    required void Function(String reason) onConfirmReject,
  }) {
    final TextEditingController explanationController = TextEditingController();

    showNopaModal<void>(
      context,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      builder: (BuildContext ctx) {
        return NopaModalShell(
          maxWidth: 420,
          headerIcon: Icons.shield_outlined,
          title: 'پیام به دانش آموز',
          padding: const EdgeInsets.all(22),
          actions: [
            NopaModalAction(
              label: 'ارسال',
              onPressed: () {
                Navigator.pop(ctx);
                onConfirmReject(explanationController.text.trim());
              },
            ),
            NopaModalAction(
              label: 'لغو',
              variant: NopaModalActionVariant.secondary,
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                      SizedBox(
                        width: 90,
                        child: Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'شرح دهید:',
                            style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
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
                            style: AppTypography.bodyMedium,
                            decoration: InputDecoration(
                              isDense: true,
                              hintText: 'توضیحات تان درمورد تصمیم تان را برای عضو مورد نظر بنویسید',
                              hintStyle: AppTypography.caption.copyWith(color: Color(0xFF8882A8)),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

            ],
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
            style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
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
              style: AppTypography.h3,
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
    return TapExpander(child: GestureDetector(
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
                      style: AppTypography.h3,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Middle: Label
                Text(
                  label,
                  style: AppTypography.h3,
                ),
                const SizedBox(width: 16),
                // Left: Value
                Text(
                  value,
                  style: AppTypography.h2,
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
        ),
      ),
    ));
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
              style: AppTypography.h2,
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
                          Text(
                            'پس از تعیین مقدار مبادله، ثبت درخواست را بزنید تا درخواست شما برای مربی ارسال شود. درصورت تایید مربی مبادله شما نهایی خواهد شد.',
                            textAlign: TextAlign.justify,
                            style: AppTypography.caption.copyWith(color: Color(0xFFC7C5DD)),
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
                                  strokeBorderColor: AppColors.buttonCamel,
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
                              Padding(
                                padding: EdgeInsets.only(left: 6.0, top: 2.0),
                                child: Text(
                                  'پس از تعیین مقدار مبادله، ثبت درخواست را بزنید تا درخواست شما برای مربی ارسال شود. درصورت تایید مربی مبادله شما نهایی خواهد شد.',
                                  textAlign: TextAlign.justify,
                                  style: AppTypography.caption.copyWith(color: Color(0xFFC7C5DD)),
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
                                      strokeBorderColor: AppColors.buttonCamel,
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
            SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nارائه شده',
                style: AppTypography.caption.copyWith(color: Colors.white70),
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
            Text(
              'مقدار',
              style: AppTypography.caption.copyWith(color: Colors.white70),
            ),
            const SizedBox(width: 4),
            _buildAmountInputBox(),
          ],
        ),

        const SizedBox(height: 10),

        // Row 2: سرمایه درخواستی
        Row(
          children: [
            SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nدرخواستی',
                style: AppTypography.caption.copyWith(color: Colors.white70),
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
            Text(
              'مقدار',
              style: AppTypography.caption.copyWith(color: Colors.white70),
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
            style: AppTypography.bodyLarge,
            items: _availableAssets.map((asset) {
              return DropdownMenuItem<String>(
                value: asset,
                child: Text(AssetNames.labelFor(asset), style: AppTypography.bodyMedium),
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
          style: AppTypography.h3,
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
          style: AppTypography.h3.copyWith(color: Color(0xFFFFD580)),
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
      child: TapExpander(child: InkWell(
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
              style: AppTypography.h3.copyWith(color: isActive ? Colors.white : const Color(0xFFD6D7E5)),
            ),
          ),
        ),
      )),
    );
  }

  /// Section 4: برترین ها (لیگ) - Top 3 Podium & Leaderboard Switcher
  Widget _buildLeaderboardSection(UserModel? user, {String? myCaravanId}) {
    // Top 3 of the selected tab, read from the leaderboard API (padded when fewer than 3 exist)
    const podiumColors = [Color(0xFFFFD580), Color(0xFFCBD5E1), Color(0xFFC8824C)];
    const podiumSizes = [92.0, 78.0, 72.0];
    final bool isMembersTab = _selectedLeaderboardTab == 0;
    final source = isMembersTab ? _topMembers : _topCaravans;
    final currentList = List<Map<String, dynamic>>.generate(3, (i) {
      final bool hasItem = i < source.length;
      return {
        'rank': i + 1,
        'name': hasItem ? source[i]['name'] : '-',
        'zarik': hasItem ? source[i]['zarik'] : '',
        'color': podiumColors[i],
        'borderColor': podiumColors[i],
        'size': podiumSizes[i],
      };
    });
    final firstPlace = currentList[0];
    final secondPlace = currentList[1];
    final thirdPlace = currentList[2];

    final List<String> rankedIds = isMembersTab ? _memberIds : _caravanIds;
    final String? myId = isMembersTab ? user?.id : myCaravanId;
    final int myIndex = myId == null ? -1 : rankedIds.indexOf(myId);
    final String totalText = rankedIds.length.toString();
    final String myRankText = myIndex >= 0 ? (myIndex + 1).toString() : '-';

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
              style: AppTypography.h2,
            ),
          ),
        ),
        const SizedBox(height: 14),

        // 2. Tab switcher (shared segmented style)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: NopaPillTabs<int>(
            expand: true,
            selected: _selectedLeaderboardTab,
            tabs: const [
              NopaPillTab<int>(0, 'برترین شرکت کننده ها'),
              NopaPillTab<int>(1, 'برترین کاروان ها'),
            ],
            onChanged: (v) => setState(() => _selectedLeaderboardTab = v),
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
                    style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
                    children: [
                      const TextSpan(text: 'تعداد کل: '),
                      TextSpan(
                        text: totalText.toPersianDigits(),
                        style: AppTypography.h3,
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 32),

                // رتبه شما
                RichText(
                  text: TextSpan(
                    style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
                    children: [
                      const TextSpan(text: 'رتبه شما: '),
                      TextSpan(
                        text: myRankText.toPersianDigits(),
                        style: AppTypography.h3,
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
                style: AppTypography.h3,
              ),
            ),
          ],
        ),

        const SizedBox(height: 4),

        // Zarik Wealth (flat text, no glowing shadows)
        Text(
          (item['zarik'] as String).toPersianDigits(),
          style: AppTypography.caption.copyWith(color: Color(0xFFFFD580)),
        ),
      ],
    );
  }
}
