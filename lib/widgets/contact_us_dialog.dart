import 'package:flutter/material.dart';

class ContactUsDialog extends StatelessWidget {
  const ContactUsDialog({super.key});

  static void show(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const ContactUsDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1435),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        padding: const EdgeInsets.all(22),
        width: 350,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
                const Text(
                  'ارتباط با ما',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ],
            ),
            const Divider(color: Colors.white12),
            const SizedBox(height: 14),

            _buildContactField('📞 تلفن پشتیبانی:', '۰۲۱-۹۱۰۷۸۶۴۵'),
            const SizedBox(height: 12),
            _buildContactField('✉️ ایمیل پشتیبانی:', 'support@nopa.ir'),
            const SizedBox(height: 12),
            _buildContactField('🕒 ساعات کاری:', 'شنبه تا چهارشنبه - ۹:۰۰ الی ۱۷:۰۰'),
            const SizedBox(height: 12),
            _buildContactField('📍 نشانی دفتر مرکزی:', 'تهران، میدان ونک، خیابان ولیعصر، برج نپا، طبقه ۴'),
            const SizedBox(height: 12),
            _buildContactField('🕒 موقعیت جغرافیایی:', '۳۵.۷۶۸۹° N, ۵۱.۴۰۷۸° E'),
            const SizedBox(height: 12),
            _buildContactField('📱 شبکه‌های اجتماعی:', '@nopa_app'),

            const SizedBox(height: 20),
            Center(
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('در حال مسیریابی به سمت دفتر نپا...', style: TextStyle(fontFamily: 'Vazirmatn')),
                      backgroundColor: Color(0xFF8B5CF6),
                    ),
                  );
                },
                icon: const Icon(Icons.map, color: Colors.white, size: 16),
                label: const Text(
                  'مسیریابی روی نقشه',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn', fontSize: 12),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildContactField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'Vazirmatn'),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.right,
          style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4, fontFamily: 'Vazirmatn'),
        ),
      ],
    );
  }
}
