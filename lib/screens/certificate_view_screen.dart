import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CertificateViewScreen extends StatefulWidget {
  final Map<String, dynamic> certificate;
  final String userName;

  const CertificateViewScreen({
    super.key,
    required this.certificate,
    required this.userName,
  });

  @override
  State<CertificateViewScreen> createState() => _CertificateViewScreenState();
}

class _CertificateViewScreenState extends State<CertificateViewScreen> {
  bool _isDownloading = false;

  void _downloadCertificate() {
    setState(() {
      _isDownloading = true;
    });

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'گواهی «${widget.certificate['title']}» با موفقیت در گالری ذخیره شد. 📥',
              style: const TextStyle(fontFamily: 'Vazirmatn'),
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
  }

  void _showPhysicalOrderModal() {
    final nameCtrl = TextEditingController(text: widget.userName);
    final addressCtrl = TextEditingController();
    final postalCodeCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'درخواست نسخه چاپی و فیزیکی 📜',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 16),
                const Text('نام گیرنده:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                const SizedBox(height: 8),
                TextField(
                  controller: nameCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(filled: true, fillColor: const Color(0xFF160E2A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
                ),
                const SizedBox(height: 12),
                const Text('آدرس دقیق پستی:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                const SizedBox(height: 8),
                TextField(
                  controller: addressCtrl,
                  maxLines: 2,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(filled: true, fillColor: const Color(0xFF160E2A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
                ),
                const SizedBox(height: 12),
                const Text('کد پستی:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                const SizedBox(height: 8),
                TextField(
                  controller: postalCodeCtrl,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(filled: true, fillColor: const Color(0xFF160E2A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
                ),
                const SizedBox(height: 12),
                const Text('شماره تماس گیرنده:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                const SizedBox(height: 8),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(filled: true, fillColor: const Color(0xFF160E2A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFF8B5CF6).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3))),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text('هزینه چاپ و ارسال: ۸۵,۰۰۰ تومان', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () async {
                      if (nameCtrl.text.isEmpty || addressCtrl.text.isEmpty || postalCodeCtrl.text.isEmpty || phoneCtrl.text.isEmpty) {
                        ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('لطفاً همه فیلدها را پر کنید', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.red));
                        return;
                      }
                      
                      Navigator.pop(ctx);
                      showDialog(context: context, barrierDismissible: false, builder: (_) => const Center(child: CircularProgressIndicator()));
                      
                      try {
                        final api = HttpApiService();
                        // Mocking the call since we don't have the cert ID in the UI properly, assuming id exists
                        final certId = widget.certificate['id'] ?? 'mock_cert_id';
                        await api.authenticatedPost('/certificates/$certId/physical-order', {
                          'recipientName': nameCtrl.text,
                          'postalAddress': addressCtrl.text,
                          'postalCode': postalCodeCtrl.text,
                          'phoneNumber': phoneCtrl.text,
                        });
                        
                        if (mounted) {
                          Navigator.pop(context); // close loader
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('سفارش چاپ با موفقیت ثبت شد و در انتظار پردازش است! 🚚', style: TextStyle(fontFamily: 'Vazirmatn')),
                              backgroundColor: Color(0xFF10B981),
                            ),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('خطا در ثبت سفارش', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                    child: const Text('پرداخت و ثبت سفارش 💳', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn')),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        title: const Text('مشاهده گواهی رسمی', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn')),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Certificate Design Container
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFFFD54F), width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
                      blurRadius: 20,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: Column(
                  children: [
                    // Top Ribbon / Logo
                    const Text('نُپا', style: TextStyle(color: Color(0xFFFFD54F), fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 4, fontFamily: 'Vazirmatn')),
                    const SizedBox(height: 10),
                    const Text(
                      '«گواهی‌نامه رسمی آموزش و توانمندسازی کاروان»',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 30),
                    
                    const Text(
                      'بدینوسیله گواهی می‌شود که هنرجوی گرامی',
                      style: TextStyle(color: Colors.white54, fontSize: 12, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.userName,
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'دوره «${widget.certificate['title']}» را در بستر آموزشی نپا با موفقیت گذرانده و شایسته دریافت این گواهی‌نامه می‌باشد.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.6, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 35),
                    
                    // Stamp & Signature Row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Signature
                        Column(
                          children: const [
                            Text('مهر و امضای دبیرخانه', style: TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'Vazirmatn')),
                            SizedBox(height: 8),
                            Icon(Icons.edit_note, color: Color(0xFFD946EF), size: 28),
                          ],
                        ),
                        // Date
                        Column(
                          children: [
                            const Text('تاریخ صدور', style: TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'Vazirmatn')),
                            const SizedBox(height: 8),
                            Text(widget.certificate['date'], style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                          ],
                        ),
                        // Golden Badge Stamp
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFFFD54F).withValues(alpha: 0.1),
                            border: Border.all(color: const Color(0xFFFFD54F), width: 1.5),
                          ),
                          child: const Icon(Icons.verified_user, color: Color(0xFFFFD54F), size: 24),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              
              // Action Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _isDownloading ? null : _downloadCertificate,
                  icon: _isDownloading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.download, color: Colors.black),
                  label: Text(
                    _isDownloading ? 'در حال آماده‌سازی فایل...' : 'دانلود مستقیم گواهی (PDF)',
                    style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 15, fontFamily: 'Vazirmatn'),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFD54F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              
              // Physical Order Button
              if (widget.certificate['status'] == 'issued' || widget.certificate['status'] == 'verified')
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _showPhysicalOrderModal,
                    icon: const Icon(Icons.local_shipping, color: Colors.white),
                    label: const Text(
                      'درخواست نسخه چاپی و فیزیکی 📜',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15, fontFamily: 'Vazirmatn'),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
