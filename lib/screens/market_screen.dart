import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../services/api_service.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';


class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  // Mock prices that can dynamically change
  final Map<String, double> _marketPrices = {
    'نخ': 500.0,
    'فرش ساده': 2500.0,
    'فرش طرح‌دار': 4000.0,
    'بیرق نخی': 2000.0,
    'بیرق برنزی': 6000.0,
    'بیرق نقره‌ای': 12000.0,
    'بیرق طلایی': 20000.0,
  };

  // Price changes (deltas) for decoration
  final Map<String, String> _priceChanges = {
    'نخ': '+۲.۵٪ ▲',
    'فرش ساده': '+۱.۲٪ ▲',
    'فرش طرح‌دار': '+۳.۱٪ ▲',
    'بیرق نخی': '-۰.۸٪ ▼',
    'بیرق برنزی': '+۴.۵٪ ▲',
    'بیرق نقره‌ای': '+۲.۱٪ ▲',
    'بیرق طلایی': '+۵.۰٪ ▲',
  };

  // Exchange calculator states
  String _sourceAsset = 'زریک';
  String _targetAsset = 'نخ';
  final TextEditingController _amountController = TextEditingController(text: '100');
  double _calculatedResult = 0.2; // default: 100 Zarik = 0.2 Nakh (since 500 Zarik = 1 Nakh)

  final List<String> _assets = ['زریک', 'نخ', 'فرش', 'بیرق مسی', 'بیرق نقره‌ای', 'بیرق طلایی'];

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    // Compute initial value directly without triggering setState during building
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final double sourceVal = _getAssetValueInZarik(_sourceAsset);
    final double targetVal = _getAssetValueInZarik(_targetAsset);
    if (targetVal > 0) {
      _calculatedResult = (amount * sourceVal) / targetVal;
    } else {
      _calculatedResult = 0.0;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  // Conversion logic based on the user instructions
  // 1 Gold flag = 3 Silver = 9 Carpet = 45 Nakh/Kalaf
  // 1 Silver flag = 3 Carpet = 15 Nakh
  // 1 Carpet = 5 Nakh
  // 1 Copper flag = 5 Nakh
  // 1 Nakh = 500 Zarik (based on market rate)
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
      if (targetVal > 0) {
        _calculatedResult = (amount * sourceVal) / targetVal;
      } else {
        _calculatedResult = 0.0;
      }
    });
  }

  void _triggerExchange() {
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    if (amount <= 0) return;

    // Simulate price fluctuation upon exchange (supply and demand)
    setState(() {
      // Selling sourceAsset decreases its price slightly, buying targetAsset increases its price
      if (_marketPrices.containsKey(_sourceAsset)) {
        _marketPrices[_sourceAsset] = _marketPrices[_sourceAsset]! * 0.98;
        _priceChanges[_sourceAsset] = '-۱.۵٪ ▼';
      }
      if (_marketPrices.containsKey(_targetAsset)) {
        _marketPrices[_targetAsset] = _marketPrices[_targetAsset]! * 1.03;
        _priceChanges[_targetAsset] = '+۳.۲٪ ▲';
      }
    });

    // Show congratulation dialog
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
                  'تبریک! 🎉',
                  style: TextStyle(
                    color: Color(0xFFFFD54F),
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'شما ${_calculatedResult.toStringAsFixed(1)} $_targetAsset به دست آوردید!',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                const Text(
                  'معامله شما به راهبر ارسال شد. بعد از اینکه راهبر این معامله را تایید کند، کار انجام و معامله تایید نهایی می‌شود.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    minimumSize: const Size(120, 45),
                  ),
                  child: const Text('متوجه شدم', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }



  Widget _buildMarketBannerCarousel() {
    final List<Map<String, String>> banners = [
      {
        'title': 'پویش بزرگ زریک طلایی 🏆',
        'desc': 'تکمیل مأموریت‌های هفتگی با ۳ برابر امتیاز زریک بیشتر!',
        'bg': '0xFF4C1D95',
      },
      {
        'title': 'جشنواره مبادلات کاروان 🛒',
        'desc': 'تا ۵۰٪ زریک کمتر برای مبادله بیرق‌های برنزی و نقره‌ای',
        'bg': '0xFF064E3B',
      },
      {
        'title': 'آخرین مظنه و اخبار بازار کاروان 📊',
        'desc': 'نرخ روز زریک را هر لحظه از بازارچه نپا دنبال کنید',
        'bg': '0xFF881337',
      },
    ];

    return SizedBox(
      height: 120,
      child: PageView.builder(
        itemCount: banners.length,
        controller: PageController(viewportFraction: 0.95),
        itemBuilder: (context, index) {
          final banner = banners[index];
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 5),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Color(int.parse(banner['bg']!)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  banner['title']!,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 6),
                Text(
                  banner['desc']!,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        return Scaffold(
          backgroundColor: const Color(0xFF0F081D),
          appBar: AppBar(
            title: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'بازارچه و مبادلات',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20, fontFamily: 'Vazirmatn'),
                ),
                SizedBox(width: 8),
                Text('🛒', style: TextStyle(fontSize: 20)),
              ],
            ),
            backgroundColor: Colors.transparent,
            elevation: 0,
            centerTitle: true,
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMarketBannerCarousel(),
                const SizedBox(height: 20),
                
                // NEW Section: Zarik Purchase Store
                _buildZarikStoreSection(context, repository),
                const SizedBox(height: 25),

                // Section 1: Market Rates Grid
                _buildMarketRatesGrid(),
                const SizedBox(height: 25),
                
                // Section 2: Caravan Exchange (Interactive panel)
                _buildCaravanExchangePanel(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        );
      }
    );
  }

  Widget _buildZarikStoreSection(BuildContext context, AppRepository repository) {
    final List<Map<String, dynamic>> zarikPackages = [
      {'zarik': 100, 'price': '۲۰,۰۰۰ تومان', 'icon': Icons.monetization_on, 'color': Colors.amber},
      {'zarik': 500, 'price': '۹۰,۰۰۰ تومان', 'icon': Icons.star, 'color': Colors.orange},
      {'zarik': 1000, 'price': '۱۵۰,۰۰۰ تومان', 'icon': Icons.diamond, 'color': Colors.blue},
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('💎', style: TextStyle(fontSize: 18)),
              Text(
                'فروشگاه خرید زریک (Zarik Store)',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: zarikPackages.length,
            itemBuilder: (context, index) {
              final pkg = zarikPackages[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.02)),
                ),
                child: Row(
                  children: [
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.purple,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => _buyPackage(pkg['zarik'], pkg['price'], repository),
                      child: const Text('خرید', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                    const Spacer(),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${pkg['zarik']} زریک', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(height: 4),
                        Text('مبلغ: ${pkg['price']}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(width: 12),
                    CircleAvatar(
                      backgroundColor: pkg['color'].withValues(alpha: 0.2),
                      child: Icon(pkg['icon'], color: pkg['color'], size: 20),
                    )
                  ],
                ),
              );
            },
          )
        ],
      ),
    );
  }

  Future<void> _buyPackage(int zarikAmount, String priceStr, AppRepository repository) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1435),
        title: const Text('تایید خرید زریک', style: TextStyle(color: Colors.white)),
        content: Text('مبلغ $priceStr برای خرید $zarikAmount زریک. (درگاه شبیه‌سازی شده)', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('پرداخت و خرید', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );

      // Using HttpApiService mock
      final api = HttpApiService();
      final success = await api.buyZarikPackage(zarikAmount);
      
      if (!mounted) return;
      Navigator.pop(context); // close loader

      if (success) {
        await repository.refreshUser(); // update locally
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$zarikAmount زریک با موفقیت به کیف پول شما اضافه شد!', style: const TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.green),
          );
        }
      }
    }
  }

  Widget _buildMarketRatesGrid() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('📊', style: TextStyle(fontSize: 18)),
              Text(
                'مظنه بازار (قیمت‌های روز زریک)',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.7,
            ),
            itemCount: _marketPrices.length,
            itemBuilder: (context, index) {
              final key = _marketPrices.keys.elementAt(index);
              final price = _marketPrices[key]!;
              final change = _priceChanges[key]!;
              final isUp = change.contains('▲');

              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.02)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '${price.toInt()} زریک',
                      style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'هر $key',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      change,
                      style: TextStyle(
                        color: isUp ? const Color(0xFF10B981) : Colors.redAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
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

  Widget _buildCaravanExchangePanel() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('🔄', style: TextStyle(fontSize: 18)),
              Text(
                'صرافی و مبادلات کاروان',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Source Asset Selection Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('سرمایه فروشی:', style: TextStyle(color: Colors.white70, fontSize: 13)),
              DropdownButton<String>(
                value: _sourceAsset,
                dropdownColor: const Color(0xFF1E1435),
                style: const TextStyle(color: Colors.white, fontSize: 14),
                underline: Container(height: 1, color: const Color(0xFF8B5CF6)),
                items: _assets.map((asset) {
                  return DropdownMenuItem(value: asset, child: Text(asset));
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
            ],
          ),
          const SizedBox(height: 12),
          
          // Amount Input
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              hintText: 'تعداد را وارد کنید',
              hintStyle: const TextStyle(color: Colors.white24),
              filled: true,
              fillColor: const Color(0xFF160E2A),
              contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),
          
          // Target Asset Selection Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('سرمایه خریداری:', style: TextStyle(color: Colors.white70, fontSize: 13)),
              DropdownButton<String>(
                value: _targetAsset,
                dropdownColor: const Color(0xFF1E1435),
                style: const TextStyle(color: Colors.white, fontSize: 14),
                underline: Container(height: 1, color: const Color(0xFF8B5CF6)),
                items: _assets.map((asset) {
                  return DropdownMenuItem(value: asset, child: Text(asset));
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
            ],
          ),
          const SizedBox(height: 20),
          
          // Output Result calculation indicator
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF160E2A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'دریافت می‌کنید: ${_calculatedResult.toStringAsFixed(2)} $_targetAsset',
                style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Swap Submit Button
          Container(
            width: double.infinity,
            height: 50,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: ElevatedButton(
              onPressed: _triggerExchange,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text(
                'تایید و ارسال به راهبر',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
