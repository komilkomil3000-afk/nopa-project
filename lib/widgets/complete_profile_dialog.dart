import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';

class CompleteProfileDialog extends StatefulWidget {
  final UserModel user;

  const CompleteProfileDialog({super.key, required this.user});

  static Future<void> show(BuildContext context, UserModel user) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => CompleteProfileDialog(user: user),
    );
  }

  @override
  State<CompleteProfileDialog> createState() => _CompleteProfileDialogState();
}

class _CompleteProfileDialogState extends State<CompleteProfileDialog> {
  late TextEditingController _nameCtrl;
  late TextEditingController _nationalIdCtrl;
  late TextEditingController _dobCtrl;
  late TextEditingController _addressCtrl;

  late String _selectedProvince;
  late String _selectedCity;
  bool _isSaving = false;

  static const Map<String, List<String>> _iranProvincesAndCities = {
    'تهران': ['تهران', 'ری', 'شمیرانات', 'اسلامشهر', 'شهریار', 'قدس', 'ملارد', 'ورامین', 'پاکدشت', 'دماوند', 'فیروزکوه', 'رباط‌کریم', 'بهارستان', 'پردیس', 'قرچک'],
    'خراسان رضوی': ['مشهد', 'نیشابور', 'سبزوار', 'تربت حیدریه', 'کاشمر', 'قوچان', 'تربت جام', 'تایباد', 'چناران', 'سرخس', 'گناباد', 'فریمان'],
    'اصفهان': ['اصفهان', 'کاشان', 'خمینی‌شهر', 'نجف‌آباد', 'شاهین‌شهر', 'شهرضا', 'فولادشهر', 'مبارکه', 'آران و بیدگل', 'زرین‌شهر', 'گلپایگان', 'فریدن', 'نطنز'],
    'فارس': ['شیراز', 'مرودشت', 'جهرم', 'فسا', 'کازرون', 'داراب', 'لارستان', 'آباده', 'نورآباد', 'اقلید', 'استهبان', 'نی‌ریز', 'فیروزآباد'],
    'خوزستان': ['اهواز', 'دزفول', 'آبادان', 'خرمشهر', 'ماهشهر', 'شوش', 'شوشتر', 'مسجد سلیمان', 'ایذه', 'رامهرمز', 'امیدیه', 'بهبهان', 'اندیمشک'],
    'آذربایجان شرقی': ['تبریز', 'مراغه', 'مرند', 'میانه', 'اهر', 'بناب', 'سراب', 'آذرشهر', 'عجب‌شیر', 'شبستر', 'ملکان', 'بستان‌آباد'],
    'مازندران': ['ساری', 'بابل', 'آمل', 'قائم‌شهر', 'بهشهر', 'چالوس', 'نکا', 'بابلسر', 'تنکابن', 'نوشهر', 'فریدونکنار', 'رامسر'],
    'گیلان': ['رشت', 'بندر انزلی', 'لاهیجان', 'لنگرود', 'هشتپر (تالش)', 'آستارا', 'صومعه‌سرا', 'فومن', 'رودسر', 'رودبار'],
    'آذربایجان غربی': ['ارومیه', 'خوی', 'بوکان', 'مهاباد', 'میاندوآب', 'سلماس', 'نقده', 'پیرانشهر', 'سردشت', 'شاهین‌دژ'],
    'کرمان': ['کرمان', 'سیرجان', 'رفسنجان', 'جیرفت', 'بم', 'زرند', 'بافت', 'شهربابک', 'کهنوج', 'بردسیر'],
    'البرز': ['کرج', 'فردیس', 'کمال‌شهر', 'نظرآباد', 'محمدشهر', 'ماهدشت', 'مشکین‌دشت', 'هشتگرد', 'چهارباغ', 'اشتهارد'],
    'قم': ['قم', 'قنوات', 'جعفریه', 'کهک', 'دستجرد', 'سلفچگان'],
    'کرمانشاه': ['کرمانشاه', 'اسلام‌آباد غرب', 'جوانرود', 'کنگاور', 'سرپل ذهاب', 'سنقر', 'هرسین', 'صحنه', 'پاوه'],
    'یزد': ['یزد', 'میبد', 'اردکان', 'بافق', 'مهریز', 'ابرکوه', 'اشکذر', 'تفت', 'هرات', 'مروست'],
    'همدان': ['همدان', 'ملایر', 'نهاوند', 'اسدآباد', 'تویسرکان', 'بهار', 'کبودرآهنگ', 'رزن', 'فامنین'],
    'مرکزی': ['اراک', 'ساوه', 'خمین', 'محلات', 'دلیجان', 'شازند', 'زرندیه', 'تفرش', 'کمیجان', 'آشتیان'],
    'هرمزگان': ['بندرعباس', 'میناب', 'قشم', 'کیش', 'بندر لنگه', 'رودان', 'بستک', 'حاجی‌آباد', 'جاسک'],
    'کردستان': ['سنندج', 'سقز', 'مریوان', 'بانه', 'قروه', 'کامیاران', 'بیجار', 'دیواندره', 'دهگلان'],
    'لرستان': ['خرم‌آباد', 'بروجرد', 'دورود', 'کوهدشت', 'الیگودرز', 'نورآباد', 'ازنا', 'پلدختر', 'الشتر'],
    'بوشهر': ['بوشهر', 'برازجان', 'بندر گناوه', 'بندر کنگان', 'خورموج', 'بندر جم', 'بندر عسلویه', 'بندر دیر', 'بندر دیلم'],
    'زنجان': ['زنجان', 'ابهر', 'خرمدره', 'قیدار', 'هیدج', 'صائین‌قلعه', 'آب‌بر'],
    'سیستان و بلوچستان': ['زاهدان', 'زابل', 'ایرانشهر', 'چابهار', 'سراوان', 'خاش', 'کنارک', 'راسک'],
    'قزوین': ['قزوین', 'الوند', 'تاکستان', 'آبیک', 'اقبالیه', 'محمدیه', 'بیدستان', 'بوئین‌زهرا'],
    'گلستان': ['گرگان', 'گنبد کاووس', 'علی‌آباد کتول', 'بندر ترکمن', 'آق‌قلا', 'کلاله', 'آزادشهر', 'کردکوی'],
    'اردبیل': ['اردبیل', 'پارس‌آباد', 'مشگین‌شهر', 'خلخال', 'گرمی', 'نمین', 'بیله‌سوار', 'سرعین'],
    'خراسان جنوبی': ['بیرجند', 'قائن', 'طبس', 'فردوس', 'نهبندان', 'سرایان', 'سربیشه', 'بشرویه'],
    'چهارمحال و بختیاری': ['شهرکرد', 'بروجن', 'لردگان', 'فرخ‌شهر', 'فارسان', 'سامان', 'هفشجان'],
    'کهگیلویه و بویراحمد': ['یاسوج', 'دوگنبدان (گچساران)', 'دهدشت', 'لیکک', 'چرام', 'لنده', 'باشت', 'سی‌سخت'],
    'سمنان': ['سمنان', 'شاهرود', 'دامغان', 'گرمسار', 'مهدی‌شهر', 'ایوانکی', 'سرخه', 'شهمیرزاد'],
    'خراسان شمالی': ['بجنورد', 'شیروان', 'اسفراین', 'آشخانه', 'جاجرم', 'گرمه', 'فاروج'],
    'ایلام': ['ایلام', 'دهلران', 'ایوان', 'آبدانان', 'دره‌شهر', 'مهران', 'سرابله', 'ملکشاهی'],
  };

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.user.name);
    _nationalIdCtrl = TextEditingController(text: widget.user.nationalId ?? '');
    _dobCtrl = TextEditingController(text: widget.user.dateOfBirth ?? '');

    String initialProvince = 'تهران';
    String initialCity = 'تهران';
    String initialAddress = '';

    if (widget.user.city != null && widget.user.city!.isNotEmpty) {
      final parts = widget.user.city!.split(' - ');
      if (parts.isNotEmpty && _iranProvincesAndCities.containsKey(parts[0].trim())) {
        initialProvince = parts[0].trim();
        if (parts.length > 1 && _iranProvincesAndCities[initialProvince]!.contains(parts[1].trim())) {
          initialCity = parts[1].trim();
        } else {
          initialCity = _iranProvincesAndCities[initialProvince]!.first;
        }
        if (parts.length > 2) {
          initialAddress = parts.sublist(2).join(' - ').trim();
        }
      } else {
        initialAddress = widget.user.city!;
      }
    }

    _selectedProvince = initialProvince;
    _selectedCity = initialCity;
    _addressCtrl = TextEditingController(text: initialAddress);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _nationalIdCtrl.dispose();
    _dobCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Widget _buildLabel(String text) {
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          fontFamily: 'Vazirmatn',
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(
        color: Colors.white30,
        fontSize: 12,
        fontFamily: 'Vazirmatn',
      ),
      filled: true,
      fillColor: const Color(0xFF150D27),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white12),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF8B5CF6), width: 1.5),
      ),
    );
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final nationalId = _nationalIdCtrl.text.trim();

    if (name.isEmpty || nationalId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'لطفاً نام و کد ملی را وارد نمایید',
            style: TextStyle(fontFamily: 'Vazirmatn'),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (nationalId.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'کد ملی باید ۱۰ رقم باشد',
            style: TextStyle(fontFamily: 'Vazirmatn'),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final fullAddress = _addressCtrl.text.trim().isNotEmpty
        ? '$_selectedProvince - $_selectedCity - ${_addressCtrl.text.trim()}'
        : '$_selectedProvince - $_selectedCity';

    setState(() => _isSaving = true);

    try {
      final api = HttpApiService();
      await api.completeProfile({
        'name': name,
        'nationalId': nationalId,
        'dateOfBirth': _dobCtrl.text.trim(),
        'city': fullAddress,
      });

      if (!mounted) return;
      await Provider.of<AppRepository>(context, listen: false).refreshUser();

      if (!mounted) return;
      Navigator.of(context).pop();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.stars_rounded, color: Color(0xFFFFD54F)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  '🎉 پروفایل شما با موفقیت تکمیل شد و ۱۰۰ زریک به حساب شما افزوده گردید!',
                  style: TextStyle(fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          backgroundColor: Color(0xFF10B981),
          duration: Duration(seconds: 4),
        ),
      );
    } catch (e) {
      setState(() => _isSaving = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'خطا در ذخیره مشخصات: $e',
            style: const TextStyle(fontFamily: 'Vazirmatn'),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<String> currentCities = _iranProvincesAndCities[_selectedProvince] ?? ['تهران'];
    if (!currentCities.contains(_selectedCity)) {
      _selectedCity = currentCities.first;
    }

    return Dialog(
      backgroundColor: const Color(0xFF1E1435),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                ),
                const Row(
                  children: [
                    Text(
                      'تکمیل پروفایل و دریافت سکه',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    SizedBox(width: 6),
                    Icon(Icons.workspace_premium_rounded, color: Color(0xFFFFD54F), size: 22),
                  ],
                ),
              ],
            ),
            const Divider(color: Colors.white12),
            const SizedBox(height: 10),

            // Reward callout banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3B1E6D), Color(0xFF1F1138)],
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.4)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.monetization_on_rounded, color: Color(0xFFFFD54F), size: 24),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'با تکمیل مشخصات هویتی، ۱۰۰ سکه زریک بلافاصله به کیف پول شما واریز می‌شود! 🪙',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11.5,
                        fontFamily: 'Vazirmatn',
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Name
            _buildLabel('نام و نام خانوادگی:'),
            const SizedBox(height: 6),
            TextField(
              controller: _nameCtrl,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
              decoration: _inputDecoration('مثال: علی رضایی'),
            ),
            const SizedBox(height: 12),

            // National ID
            _buildLabel('کد ملی (۱۰ رقم):'),
            const SizedBox(height: 6),
            TextField(
              controller: _nationalIdCtrl,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.right,
              maxLength: 10,
              style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
              decoration: _inputDecoration('مثال: 0012345678').copyWith(counterText: ''),
            ),
            const SizedBox(height: 12),

            // Date of birth
            _buildLabel('تاریخ تولد:'),
            const SizedBox(height: 6),
            TextField(
              controller: _dobCtrl,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
              decoration: _inputDecoration('مثال: ۱۳۸۸/۰۵/۲۲'),
            ),
            const SizedBox(height: 14),

            // Province
            _buildLabel('استان:'),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF150D27),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedProvince,
                  isExpanded: true,
                  dropdownColor: const Color(0xFF1E1435),
                  icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF38BDF8)),
                  style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontSize: 13),
                  items: _iranProvincesAndCities.keys.map((prov) {
                    return DropdownMenuItem<String>(
                      value: prov,
                      alignment: Alignment.centerRight,
                      child: Text(prov, style: const TextStyle(fontFamily: 'Vazirmatn')),
                    );
                  }).toList(),
                  onChanged: (newProv) {
                    if (newProv != null) {
                      setState(() {
                        _selectedProvince = newProv;
                        _selectedCity = _iranProvincesAndCities[newProv]!.first;
                      });
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),

            // City
            _buildLabel('شهر:'),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF150D27),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedCity,
                  isExpanded: true,
                  dropdownColor: const Color(0xFF1E1435),
                  icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF38BDF8)),
                  style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontSize: 13),
                  items: currentCities.map((c) {
                    return DropdownMenuItem<String>(
                      value: c,
                      alignment: Alignment.centerRight,
                      child: Text(c, style: const TextStyle(fontFamily: 'Vazirmatn')),
                    );
                  }).toList(),
                  onChanged: (newCity) {
                    if (newCity != null) {
                      setState(() => _selectedCity = newCity);
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Address
            _buildLabel('آدرس دقیق پستی:'),
            const SizedBox(height: 6),
            TextField(
              controller: _addressCtrl,
              maxLines: 2,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontSize: 12.5),
              decoration: _inputDecoration('خیابان، کوچه، پلاک، واحد'),
            ),
            const SizedBox(height: 22),

            // Save & Get 100 coins Button
            ElevatedButton(
              onPressed: _isSaving ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
              ),
              child: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.card_giftcard_rounded, color: Color(0xFFFFD54F), size: 19),
                        SizedBox(width: 8),
                        Text(
                          'تکمیل پروفایل و دریافت ۱۰۰ سکه',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
