import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';

class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  // Fixed standard rates for buying and selling assets across all caravans
  final List<Map<String, dynamic>> _caravanAssetRates = const [
    {
      'title': 'نخ',
      'unit': 'هر کلاف نخ',
      'zarik': 500,
      'equivalent': 'واحد پایه کاروان',
      'icon': Icons.grain_rounded,
      'color': Color(0xFF38BDF8),
    },
    {
      'title': 'فرش',
      'unit': 'هر تخته فرش',
      'zarik': 2500,
      'equivalent': 'معادل ۵ کلاف نخ',
      'icon': Icons.crop_square_rounded,
      'color': Color(0xFF10B981),
    },
    {
      'title': 'بیرق مسی',
      'unit': 'هر بیرق مسی',
      'zarik': 2500,
      'equivalent': 'معادل ۵ کلاف نخ',
      'icon': Icons.flag_rounded,
      'color': Color(0xFFFB923C),
    },
    {
      'title': 'بیرق نقره‌ای',
      'unit': 'هر بیرق نقره‌ای',
      'zarik': 7500,
      'equivalent': '۳ فرش (۱۵ نخ)',
      'icon': Icons.flag_circle_rounded,
      'color': Color(0xFFE2E8F0),
    },
    {
      'title': 'بیرق طلایی',
      'unit': 'هر بیرق طلایی',
      'zarik': 22500,
      'equivalent': '۳ نقره (۴۵ نخ)',
      'icon': Icons.workspace_premium_rounded,
      'color': Color(0xFFFFD54F),
    },
  ];

  // Exchange calculator states
  String _sourceAsset = 'زریک';
  String _targetAsset = 'نخ';
  final TextEditingController _amountController = TextEditingController(text: '500');
  double _calculatedResult = 1.0; // default: 500 Zarik = 1 Nakh

  final List<String> _assets = ['زریک', 'نخ', 'فرش', 'بیرق مسی', 'بیرق نقره‌ای', 'بیرق طلایی'];

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final double sourceVal = _getAssetValueInZarik(_sourceAsset);
    final double targetVal = _getAssetValueInZarik(_targetAsset);
    if (targetVal > 0 && amount > 0) {
      _calculatedResult = ((amount * sourceVal) / targetVal).floorToDouble();
    } else {
      _calculatedResult = 0.0;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  // Conversion logic based on caravan rules:
  // 1 Gold flag = 3 Silver = 9 Carpet = 45 Nakh/Kalaf
  // 1 Silver flag = 3 Carpet = 15 Nakh
  // 1 Carpet = 5 Nakh
  // 1 Copper flag = 5 Nakh
  // 1 Nakh = 500 Zarik
  double _getAssetValueInZarik(String asset) {
    switch (asset) {
      case 'زریک':
        return 1.0;
      case 'نخ':
        return 500.0;
      case 'فرش':
        return 2500.0; // 5 Nakh * 500
      case 'بیرق مسی':
        return 2500.0; // 5 Nakh * 500
      case 'بیرق نقره‌ای':
        return 7500.0; // 3 Carpet * 2500 = 7500
      case 'بیرق طلایی':
        return 22500.0; // 3 Silver * 7500 = 22500
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
        _calculatedResult = ((amount * sourceVal) / targetVal).floorToDouble();
      } else {
        _calculatedResult = 0.0;
      }
    });
  }

  void _triggerExchange() {
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final int receivedCount = _calculatedResult.toInt();
    if (amount <= 0 || receivedCount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'مقدار سرمایه وارد شده برای دریافت حداقل ۱ واحد کافی نیست',
            style: TextStyle(fontFamily: 'Vazirmatn'),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final String amountStr = amount % 1 == 0 ? amount.toInt().toString() : amount.toString();

    // Show confirmation dialog with mentor review note
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'ثبت درخواست مبادله 🎉',
                  style: TextStyle(
                    color: Color(0xFFFFD54F),
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'تبدیل $amountStr $_sourceAsset به $receivedCount $_targetAsset',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 12),
                const Text(
                  'درخواست معامله و مبادله شما به راهبر کاروان ارسال شد. پس از تایید راهبر، دارایی‌ها در کاروان شما به‌روزرسانی خواهند شد.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white60, fontSize: 12, height: 1.6, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    minimumSize: const Size(130, 42),
                  ),
                  child: const Text('متوجه شدم', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildMarketBannerCarousel() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: HttpApiService().getBanners(position: 'bazaar_top'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox(
            height: 110,
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final banners = snapshot.data ?? [];
        if (banners.isEmpty) {
          return const SizedBox(height: 0);
        }

        return SizedBox(
          height: 110,
          child: PageView.builder(
            itemCount: banners.length,
            controller: PageController(viewportFraction: 0.95),
            itemBuilder: (context, index) {
              final banner = banners[index];
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  image: DecorationImage(
                    image: NetworkImage(HttpApiService().resolveMediaUrl(banner['imageUrl'])),
                    onError: (e, s) => debugPrint('Image failed to load'),
                    fit: BoxFit.cover,
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.8),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        banner['title'] ?? '',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        return Scaffold(
          backgroundColor: const Color(0xFF0F081D),
          appBar: AppBar(
            title: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Text(
                  'بازارچه و مبادلات',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18, fontFamily: 'Vazirmatn'),
                ),
                SizedBox(width: 8),
                Text('🛒', style: TextStyle(fontSize: 18)),
              ],
            ),
            backgroundColor: Colors.transparent,
            elevation: 0,
            centerTitle: true,
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildMarketBannerCarousel(),
                const SizedBox(height: 16),

                // Section 1: Compact & Summarized Market Rates for Caravan Assets
                _buildMarketRatesGrid(),
                const SizedBox(height: 18),

                // Section 2: Caravan Exchange (Interactive panel)
                _buildCaravanExchangePanel(),
                const SizedBox(height: 30),
              ],
            ),
          ),
        );
      },
    );
  }

  // --- COMPACT & SUMMARIZED MARKET RATES (مظنه ارزش خرید و فروش در کل کاروان‌ها) ---
  Widget _buildMarketRatesGrid() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Text('⚖️', style: TextStyle(fontSize: 16)),
                  SizedBox(width: 6),
                  Text(
                    'مظنه رسمی سرمایه‌ها در کل کاروان‌ها',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13.5,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                ),
                child: const Text(
                  'نرخ ثابت مصوب',
                  style: TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'نرخ مصوب خرید، فروش و معادل‌سازی هر واحد سرمایه بر اساس زریک در تمامی کاروان‌ها:',
            style: TextStyle(
              color: Colors.white54,
              fontSize: 10.5,
              fontFamily: 'Vazirmatn',
            ),
          ),
          const SizedBox(height: 12),

          // Compact Grid for the 5 assets
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 2.25,
            ),
            itemCount: _caravanAssetRates.length,
            itemBuilder: (context, index) {
              final item = _caravanAssetRates[index];
              final Color color = item['color'] as Color;

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: color.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    // Asset Icon badge
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(item['icon'] as IconData, size: 16, color: color),
                    ),
                    const SizedBox(width: 8),

                    // Title and Rate info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item['title'] as String,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                              Text(
                                '${item['zarik']} زریک',
                                style: TextStyle(
                                  color: color,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item['equivalent'] as String,
                            style: const TextStyle(
                              color: Colors.white38,
                              fontSize: 9.5,
                              fontFamily: 'Vazirmatn',
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // --- CARAVAN EXCHANGE PANEL ---
  Widget _buildCaravanExchangePanel() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('🔄', style: TextStyle(fontSize: 16)),
                  SizedBox(width: 6),
                  Text(
                    'صرافی و مبادله سرمایه‌ها در کاروان',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
              Text(
                'محاسبه دقیق',
                style: TextStyle(
                  color: Color(0xFF8B5CF6),
                  fontSize: 11,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Source Asset Selection Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'سرمایه ارائه‌شده (فروش):',
                style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _sourceAsset,
                    dropdownColor: const Color(0xFF1E1435),
                    style: const TextStyle(color: Colors.white, fontSize: 12.5, fontFamily: 'Vazirmatn'),
                    items: _assets.map((asset) {
                      return DropdownMenuItem(value: asset, child: Text(asset, style: const TextStyle(fontFamily: 'Vazirmatn')));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _sourceAsset = val;
                          _recalculateExchange();
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Amount Input
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              hintText: 'تعداد یا مقدار را وارد کنید',
              hintStyle: const TextStyle(color: Colors.white24, fontSize: 12, fontFamily: 'Vazirmatn'),
              filled: true,
              fillColor: const Color(0xFF160E2A),
              contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Target Asset Selection Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'سرمایه درخواستی (خرید):',
                style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _targetAsset,
                    dropdownColor: const Color(0xFF1E1435),
                    style: const TextStyle(color: Colors.white, fontSize: 12.5, fontFamily: 'Vazirmatn'),
                    items: _assets.map((asset) {
                      return DropdownMenuItem(value: asset, child: Text(asset, style: const TextStyle(fontFamily: 'Vazirmatn')));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _targetAsset = val;
                          _recalculateExchange();
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Output Result calculation indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF160E2A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'مقدار دریافتی برآورد شده:',
                  style: TextStyle(color: Colors.white70, fontSize: 11.5, fontFamily: 'Vazirmatn'),
                ),
                Text(
                  '${_calculatedResult.toInt()} $_targetAsset',
                  style: const TextStyle(
                    color: Color(0xFFFFD54F),
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Swap Submit Button
          Container(
            width: double.infinity,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: ElevatedButton.icon(
              onPressed: _triggerExchange,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.send_rounded, size: 16, color: Colors.white),
              label: const Text(
                'ارسال برای راهبر',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13.5,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
